import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { postgresFixture } from "./helpers.mjs";
import { fixture } from "../fixtures.mjs";
import { migrate } from "../../apps/api/src/persistence/migrate.js";
import { openDatabase } from "../../apps/api/src/persistence/database.js";
import {
  backfillDefaultPlans,
  defaultPlanId,
} from "../../apps/api/src/domain/default-floor-plans.js";
import { createDefaultPlanGeometry } from "../../packages/contracts/src/floor-plans.ts";
import { saveOperation, getOperations } from "../../apps/api/src/operations.js";
import {
  saveStructure,
  deleteStructure,
} from "../../apps/api/src/domain/structure.js";

const migrationDirectory = new URL(
  "../../apps/api/src/persistence/migrations/",
  import.meta.url,
);

async function before016(pool) {
  await pool.query(
    "CREATE SCHEMA warehouse; CREATE TABLE warehouse.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await fs.readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql") && name < "016-")
    .sort()) {
    const sql = await fs.readFile(new URL(name, migrationDirectory), "utf8");
    await pool.query(sql);
    await pool.query(
      "INSERT INTO warehouse.schema_migrations(name,checksum) VALUES($1,$2)",
      [name, crypto.createHash("sha256").update(sql).digest("hex")],
    );
  }
}

test("016 preserves custom/blank plans, associates existing floors and idempotently fills missing property/building drawings", async (t) => {
  const pg = await postgresFixture(null, { applyMigration: false });
  t.after(pg.cleanup);
  await before016(pg.pool);
  await pg.pool.query(
    "INSERT INTO warehouse.properties(id,name,address,total_area,rentable_area) VALUES('p1','A','Адрес',100,90),('p2','Б','Адрес',100,90),('p3','В','Адрес',100,90); INSERT INTO warehouse.buildings(id,property_id,name) VALUES('b1','p1','Корпус'),('b2','p2','Корпус'),('b3','p3','Корпус'); INSERT INTO warehouse.entrances(id,property_id,building_id,name) VALUES('e1','p1','b1','1'); INSERT INTO warehouse.floors(id,property_id,entrance_id,name,number) VALUES('f1','p1','e1','Первый',1)",
  );
  const geometry = JSON.stringify(createDefaultPlanGeometry());
  const occupied = defaultPlanId("site", "p2");
  await pg.pool.query(
    "INSERT INTO warehouse.floor_plans(id,property_id,name,kind,floor_id,image,geometry,layers,markers,source_name,version,created_at,updated_at) VALUES ('custom-site','p1','Авторский генплан','site',NULL,'',$1,'[\"BUILDING\"]','[]','customer.dxf',7,'2025-01-01','2025-01-02'),('custom-floor','p1','Авторский этаж','floor','f1','',$1,'[\"BUILDING\"]','[]','floor.dxf',9,'2025-01-01','2025-01-02'),($2,'p2','Пустой старый чертёж','site',NULL,'','[]','[]','[]','empty.dxf',4,'2025-01-01','2025-01-02')",
    [geometry, occupied],
  );
  const before = (
    await pg.pool.query("SELECT * FROM warehouse.floor_plans ORDER BY id")
  ).rows;
  await migrate(pg.pool);
  const after = (
    await pg.pool.query("SELECT * FROM warehouse.floor_plans ORDER BY id")
  ).rows;
  assert.equal(after.length, 8);
  assert.equal(after.filter((row) => row.is_default).length, 5);
  for (const old of before) {
    const { building_id, is_default, ...retained } = after.find(
      (row) => row.id === old.id,
    );
    assert.deepEqual(retained, old);
    assert.equal(is_default, false);
  }
  assert.equal(
    after.find((row) => row.id === "custom-floor").building_id,
    "b1",
  );
  assert.equal(
    after.find(
      (row) =>
        row.property_id === "p2" && row.kind === "site" && row.is_default,
    ).id,
    defaultPlanId("site", "p2", 1),
  );
  for (const plan of after.filter((row) => row.is_default)) {
    assert.deepEqual(plan.geometry, createDefaultPlanGeometry());
    assert.equal(plan.version, 1);
    assert.equal(plan.created_by, null);
    assert.equal(plan.source_name, "default-square.dxf");
  }
  assert.equal((await migrate(pg.pool)).status, "already-migrated");
  assert.deepEqual(
    (await pg.pool.query("SELECT * FROM warehouse.floor_plans ORDER BY id"))
      .rows,
    after,
  );
});

test("Stored plan building association enforces property and actual floor ownership", async (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const pg = await postgresFixture(f.db.data);
  t.after(pg.cleanup);
  const own = f.db.data.buildings.find((b) => b.propertyId === f.property.id);
  const foreign = f.db.data.buildings.find((b) => b.propertyId === f.other.id);
  await pg.pool.query(
    "INSERT INTO warehouse.buildings(id,property_id,name) VALUES('same-property-other',$1,'Другой корпус')",
    [f.property.id],
  );
  async function invalid(buildingId, kind, floorId, code) {
    const client = await pg.pool.connect();
    try {
      await client.query("BEGIN");
      await assert.rejects(
        async () => {
          await client.query(
            "INSERT INTO warehouse.floor_plans(id,property_id,building_id,kind,floor_id,name) VALUES('invalid',$1,$2,$3,$4,'Нельзя')",
            [f.property.id, buildingId, kind, floorId],
          );
          await client.query("SET CONSTRAINTS ALL IMMEDIATE");
        },
        { code },
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  await invalid(foreign.id, "building", null, "23503");
  await invalid("same-property-other", "floor", f.unit.floor_id, "23514");
  await invalid(own.id, "building", f.unit.floor_id, "23514");
  assert.equal(
    (
      await pg.pool.query(
        "SELECT count(*)::int AS n FROM warehouse.floor_plans WHERE id='invalid'",
      )
    ).rows[0].n,
    0,
  );
});

test("Domain backfill and new creation persist once under the database write lock; saved defaults become versioned custom plans", async (t) => {
  const f = fixture();
  t.after(f.cleanup);
  f.db.data.floor_plans = [];
  const pg = await postgresFixture(f.db.data);
  const db = await openDatabase({ databaseUrl: pg.url });
  t.after(async () => {
    await db.close();
    await pg.cleanup();
  });
  const results = await Promise.all([
    db.requestScope({ source: "test default plans one" }, () =>
      backfillDefaultPlans(db),
    ),
    db.requestScope({ source: "test default plans two" }, () =>
      backfillDefaultPlans(db),
    ),
  ]);
  assert.deepEqual(results.map((r) => r.created).sort(), [0, 4]);
  const property = await db.requestScope(
    { source: "test create property" },
    () =>
      db.createProperty({
        name: "Новый",
        address: "Адрес",
        warehouseClass: "A",
        totalArea: 100,
        rentableArea: 90,
      }),
  );
  const count = await pg.pool.query(
    "SELECT count(*)::int AS n FROM warehouse.floor_plans WHERE property_id=$1 AND kind='site' AND is_default",
    [property.id],
  );
  assert.equal(count.rows[0].n, 1);
  const plan = await db.requestScope({ readOnly: true }, () =>
    getOperations(db, f.manager).floorplans.find((p) => p.kind === "site"),
  );
  await db.requestScope({ source: "test edit drawing" }, () =>
    saveOperation(db, f.admin, "floorplans", plan.id, {
      ...plan,
      name: "Мой план",
      version: plan.version,
    }),
  );
  const saved = (
    await pg.pool.query("SELECT * FROM warehouse.floor_plans WHERE id=$1", [
      plan.id,
    ])
  ).rows[0];
  assert.equal(saved.is_default, false);
  assert.equal(saved.version, 2);
  assert.equal(saved.created_by, f.admin.id);
  await assert.rejects(
    db.requestScope({ source: "test stale drawing" }, () =>
      saveOperation(db, f.admin, "floorplans", plan.id, {
        ...plan,
        name: "Stale",
      }),
    ),
    (error) => error.status === 409,
  );
  const buildingPlan = await db.requestScope({ readOnly: true }, () =>
    getOperations(db, f.manager).floorplans.find((p) => p.kind === "building"),
  );
  await db.requestScope({ source: "test move drawing level" }, () =>
    saveOperation(db, f.admin, "floorplans", buildingPlan.id, {
      ...buildingPlan,
      kind: "floor",
      floorId: f.unit.floor_id,
    }),
  );
  const replacements = (
    await pg.pool.query(
      "SELECT id,version FROM warehouse.floor_plans WHERE building_id=$1 AND kind='building' AND is_default",
      [buildingPlan.buildingId],
    )
  ).rows;
  assert.equal(replacements.length, 1);
  assert.equal(
    replacements[0].id,
    defaultPlanId("building", buildingPlan.buildingId, 1),
  );
  const target = await db.requestScope({ source: "test empty corpus" }, () =>
    saveStructure(db, "buildings", null, {
      propertyId: property.id,
      name: "Пустой корпус",
    }),
  );
  await db.requestScope({ source: "test delete default-only entities" }, () => {
    deleteStructure(db, "buildings", target.id);
    return db.deleteProperty(property.id);
  });
  assert.equal(
    (
      await pg.pool.query(
        "SELECT count(*)::int AS n FROM warehouse.floor_plans WHERE property_id=$1",
        [property.id],
      )
    ).rows[0].n,
    0,
  );
});

test("Persisted structure reparent rejects building plan scope loss atomically, then permits an explicitly unbound drawing", async (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const pg = await postgresFixture(f.db.data);
  const db = await openDatabase({ databaseUrl: pg.url });
  t.after(async () => {
    await db.close();
    await pg.cleanup();
  });
  const details = await db.requestScope(
    { source: "test bound building plan" },
    () => {
      const floor = db.getById("floors", f.unit.floor_id);
      const entrance = structuredClone(
        db.getById("entrances", floor.entranceId),
      );
      const target = saveStructure(db, "buildings", null, {
        propertyId: f.property.id,
        name: "Целевой корпус",
      });
      const plan = saveOperation(db, f.admin, "floorplans", null, {
        propertyId: f.property.id,
        name: "Привязанный корпус",
        buildingId: entrance.buildingId,
        kind: "building",
        geometry: [{ ...createDefaultPlanGeometry()[0], unitId: f.unit.id }],
        image: "",
        markers: [],
      });
      const floorPlan = saveOperation(db, f.admin, "floorplans", null, {
        propertyId: f.property.id,
        name: "План этажа",
        kind: "floor",
        floorId: floor.id,
        geometry: [{ ...createDefaultPlanGeometry()[0], unitId: f.unit.id }],
        image: "",
        markers: [],
      });
      return { entrance, target, plan, floorPlan };
    },
  );
  const before = await pg.readState();
  await assert.rejects(
    db.requestScope({ source: "test blocked unit move" }, () =>
      db.updateUnit(f.unit.id, {
        building: "Новый несуществующий корпус",
        entrance: "1",
        floor: 7,
      }),
    ),
    (error) => error.status === 409,
  );
  assert.deepEqual(await pg.readState(), before);
  await assert.rejects(
    db.requestScope({ source: "test blocked structure move" }, () =>
      saveStructure(db, "entrances", details.entrance.id, {
        ...details.entrance,
        buildingId: details.target.id,
      }),
    ),
    (error) => error.status === 409,
  );
  assert.deepEqual(await pg.readState(), before);
  await db.requestScope({ source: "test explicit unbind then move" }, () => {
    saveOperation(db, f.admin, "floorplans", details.plan.id, {
      version: details.plan.version,
      geometry: createDefaultPlanGeometry(),
    });
    return saveStructure(db, "entrances", details.entrance.id, {
      ...details.entrance,
      buildingId: details.target.id,
    });
  });
  const moved = (
    await pg.pool.query(
      "SELECT building_id,geometry,version FROM warehouse.floor_plans WHERE id=$1",
      [details.floorPlan.id],
    )
  ).rows[0];
  assert.equal(moved.building_id, details.target.id);
  assert.equal(moved.version, 2);
  assert.deepEqual(moved.geometry, details.floorPlan.geometry);
});
