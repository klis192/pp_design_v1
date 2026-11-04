import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixtures.mjs";
import { saveOperation, getOperations } from "../apps/api/src/operations.js";
import {
  saveStructure,
  deleteStructure,
} from "../apps/api/src/domain/structure.js";
import {
  backfillDefaultPlans,
  defaultPlanId,
  isUntouchedDefaultPlan,
} from "../apps/api/src/domain/default-floor-plans.js";
import { createDefaultPlanGeometry } from "../packages/contracts/src/floor-plans.ts";
import { planGeometry } from "../packages/contracts/src/operations-platform.ts";
import { operationSchemas } from "../packages/contracts/src/requests.ts";
import { exportDxf } from "../apps/web/src/features/platform/plans/geometry.ts";
import { importDxf } from "../apps/api/src/domain/cad.js";

const input = (f, patch = {}) => ({
  propertyId: f.property.id,
  name: "Пользовательский план",
  kind: "site",
  floorId: null,
  buildingId: null,
  geometry: createDefaultPlanGeometry(),
  image: "",
  markers: [],
  ...patch,
});

test("New properties and buildings receive independent closed square plans with valid DXF round trip", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  assert.equal(f.db.data.floor_plans.length, 4);
  assert.equal(
    f.db.data.floor_plans.filter((p) => p.kind === "site").length,
    2,
  );
  assert.equal(
    f.db.data.floor_plans.filter((p) => p.kind === "building").length,
    2,
  );
  for (const plan of f.db.data.floor_plans) {
    assert.equal(isUntouchedDefaultPlan(plan), true);
    assert.equal(planGeometry.safeParse(plan.geometry).success, true);
    assert.equal(plan.markers.length, 0);
    assert.equal(plan.createdBy, null);
    const imported = importDxf(exportDxf(plan.geometry));
    assert.equal(imported.geometry.length, 1);
    assert.equal(imported.geometry[0].type, "polygon");
    assert.deepEqual(imported.geometry[0].points, plan.geometry[0].points);
  }
  f.db.data.floor_plans[0].geometry[0].points[0].x = 123;
  assert.equal(f.db.data.floor_plans[1].geometry[0].points[0].x, 100);
});

test("Explicit backfill is idempotent, preserves custom geometry and blank records, and never mutates reads", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const building = f.db.data.buildings.find(
    (b) => b.propertyId === f.property.id,
  );
  f.db.data.floor_plans = [];
  const custom = saveOperation(f.db, f.admin, "floorplans", null, input(f));
  const buildingCustom = saveOperation(
    f.db,
    f.admin,
    "floorplans",
    null,
    input(f, { kind: "building", buildingId: building.id }),
  );
  const blank = {
    ...custom,
    id: "blank-legacy",
    propertyId: f.other.id,
    geometry: [],
    sourceName: "old-empty.dxf",
  };
  f.db.data.floor_plans.push(blank);
  const saved = structuredClone([custom, buildingCustom, blank]);
  assert.equal(backfillDefaultPlans(f.db).created, 2);
  assert.equal(backfillDefaultPlans(f.db).created, 0);
  for (const row of saved)
    assert.deepEqual(f.db.getById("floor_plans", row.id), row);
  const before = structuredClone(f.db.data);
  const view = getOperations(f.db, f.manager);
  assert.ok(view.floorplans.every((p) => p.propertyId === f.property.id));
  assert.deepEqual(f.db.data, before);
  assert.deepEqual(
    getOperations(f.db, { ...f.worker, role: "tenant" }).floorplans,
    [],
  );
});

test("A saved default becomes a protected custom drawing and keeps optimistic concurrency", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const plan = f.db.data.floor_plans.find(
    (p) => p.propertyId === f.property.id && p.kind === "site",
  );
  const saved = saveOperation(
    f.db,
    f.admin,
    "floorplans",
    plan.id,
    input(f, { version: 1, name: "Мой чертёж" }),
  );
  assert.equal(saved.isDefault, false);
  assert.equal(saved.version, 2);
  assert.equal(saved.createdBy, f.admin.id);
  assert.equal(isUntouchedDefaultPlan(saved), false);
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        plan.id,
        input(f, { version: 1 }),
      ),
    (error) => error.status === 409,
  );
  assert.equal(
    operationSchemas.floorplans.safeParse({ ...input(f), isDefault: true })
      .success,
    false,
  );
});

test("Building and floor associations reject cross-property and cross-building bindings", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const building = f.db.data.buildings.find(
    (b) => b.propertyId === f.property.id,
  );
  const otherBuilding = f.db.data.buildings.find(
    (b) => b.propertyId === f.other.id,
  );
  const secondUnit = f.db.createUnit({
    propertyId: f.property.id,
    number: "102",
    floor: 1,
    area: 20,
    type: "office",
    status: "vacant",
    building: "Другой корпус",
    entrance: "1",
  });
  const secondBuilding = f.db.data.buildings.find(
    (b) => b.name === "Другой корпус",
  );
  const shape = (unitId) => [{ ...createDefaultPlanGeometry()[0], unitId }];
  const count = f.db.data.floor_plans.length;
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, { kind: "building", buildingId: otherBuilding.id }),
      ),
    /другого объекта/,
  );
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, {
          kind: "floor",
          floorId: f.unit.floor_id,
          buildingId: secondBuilding.id,
        }),
      ),
    /другого корпуса/,
  );
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, {
          kind: "building",
          buildingId: building.id,
          geometry: shape(secondUnit.id),
        }),
      ),
    /другого корпуса/,
  );
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, {
          kind: "building",
          buildingId: building.id,
          markers: [{ unitId: secondUnit.id, x: 10, y: 10 }],
        }),
      ),
    /другого корпуса/,
  );
  assert.throws(
    () =>
      saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, { buildingId: building.id }),
      ),
    /Генплан/,
  );
  assert.equal(f.db.data.floor_plans.length, count);
  const floor = saveOperation(
    f.db,
    f.admin,
    "floorplans",
    null,
    input(f, { kind: "floor", floorId: f.unit.floor_id }),
  );
  assert.equal(floor.buildingId, building.id);
});

test("A floor move derives its new building without changing the drawing", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const floor = f.db.getById("floors", f.unit.floor_id);
  const entrance = f.db.getById("entrances", floor.entranceId);
  const target = saveStructure(f.db, "buildings", null, {
    propertyId: f.property.id,
    name: "Корпус Б",
  });
  const plan = saveOperation(
    f.db,
    f.admin,
    "floorplans",
    null,
    input(f, { kind: "floor", floorId: floor.id }),
  );
  const geometry = structuredClone(plan.geometry);
  saveStructure(f.db, "entrances", entrance.id, {
    propertyId: f.property.id,
    buildingId: target.id,
    name: entrance.name,
    updatedAt: entrance.updatedAt,
  });
  const fresh = f.db.getById("floor_plans", plan.id);
  assert.equal(fresh.buildingId, target.id);
  assert.equal(fresh.version, 2);
  assert.deepEqual(fresh.geometry, geometry);
});

test("Structure moves preserve building plan unit, equipment and marker scope without changing rejected data", (t) => {
  for (const reference of ["unit", "equipment", "marker"]) {
    const f = fixture();
    t.after(f.cleanup);
    const floor = f.db.getById("floors", f.unit.floor_id);
    const entrance = f.db.getById("entrances", floor.entranceId);
    const ownBuilding = f.db.getById("buildings", entrance.buildingId);
    const target = saveStructure(f.db, "buildings", null, {
      propertyId: f.property.id,
      name: "Другой корпус",
    });
    const targetEntrance = saveStructure(f.db, "entrances", null, {
      propertyId: f.property.id,
      buildingId: target.id,
      name: "Целевой подъезд",
    });
    const geometry = createDefaultPlanGeometry();
    const markers = [];
    if (reference === "unit") geometry[0].unitId = f.unit.id;
    if (reference === "equipment") {
      const equipment = saveOperation(f.db, f.admin, "equipment", null, {
        propertyId: f.property.id,
        unitId: f.unit.id,
        name: "Щит",
        type: "electrical",
      });
      geometry[0].equipmentId = equipment.id;
    }
    if (reference === "marker")
      markers.push({ unitId: f.unit.id, x: 20, y: 30 });
    const plan = saveOperation(
      f.db,
      f.admin,
      "floorplans",
      null,
      input(f, {
        kind: "building",
        buildingId: ownBuilding.id,
        geometry,
        markers,
      }),
    );
    const before = structuredClone(f.db.data);
    for (const [kind, current, fields] of [
      ["entrances", entrance, { buildingId: target.id }],
      ["floors", floor, { entranceId: targetEntrance.id }],
    ]) {
      assert.throws(
        () => saveStructure(f.db, kind, current.id, { ...current, ...fields }),
        (error) => error.status === 409,
      );
      assert.deepEqual(
        f.db.data,
        before,
        reference + " rejected move changed data",
      );
    }
    const sameBuilding = saveStructure(f.db, "entrances", null, {
      propertyId: f.property.id,
      buildingId: ownBuilding.id,
      name: "2",
    });
    saveStructure(f.db, "floors", floor.id, {
      ...floor,
      entranceId: sameBuilding.id,
    });
    assert.deepEqual(f.db.getById("floor_plans", plan.id), plan);
    assert.equal(f.db.requireUnit(f.unit.id).entrance, "2");
  }
});

test("Unit edits preserve floor/building plan scope for every binding and allow property-wide site plans", (t) => {
  for (const kind of ["floor", "building", "site"]) {
    for (const reference of ["unit", "equipment", "marker"]) {
      const f = fixture();
      t.after(f.cleanup);
      const floor = f.db.getById("floors", f.unit.floor_id);
      const buildingId = f.db.getById("entrances", floor.entranceId).buildingId;
      const geometry = createDefaultPlanGeometry();
      const markers = [];
      if (reference === "unit") geometry[0].unitId = f.unit.id;
      if (reference === "equipment") {
        const equipment = saveOperation(f.db, f.admin, "equipment", null, {
          propertyId: f.property.id,
          unitId: f.unit.id,
          name: "Щит",
          type: "electrical",
        });
        geometry[0].equipmentId = equipment.id;
      }
      if (reference === "marker")
        markers.push({ unitId: f.unit.id, x: 20, y: 30 });
      const plan = saveOperation(
        f.db,
        f.admin,
        "floorplans",
        null,
        input(f, {
          kind,
          floorId: kind === "floor" ? floor.id : null,
          buildingId: kind === "site" ? null : buildingId,
          geometry,
          markers,
        }),
      );
      if (kind === "building") {
        f.db.updateUnit(f.unit.id, { floor: 2 });
        assert.deepEqual(f.db.getById("floor_plans", plan.id), plan);
      }
      const before = structuredClone(f.db.data);
      const move = () =>
        f.db.updateUnit(f.unit.id, {
          building: "Новый корпус",
          entrance: "1",
          floor: 7,
        });
      if (kind === "site") {
        assert.equal(move().building, "Новый корпус");
        assert.deepEqual(f.db.getById("floor_plans", plan.id), plan);
      } else {
        assert.throws(move, (error) => error.status === 409);
        assert.deepEqual(
          f.db.data,
          before,
          kind + "/" + reference + " unit move changed data",
        );
      }
    }
  }
});

test("Moving a drawing to another level restores the old scope without overwriting its occupied deterministic ID", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const original = f.db.data.floor_plans.find(
    (p) => p.propertyId === f.property.id && p.kind === "site",
  );
  const changed = saveOperation(
    f.db,
    f.admin,
    "floorplans",
    original.id,
    input(f, { kind: "floor", floorId: f.unit.floor_id, version: 1 }),
  );
  assert.equal(changed.id, original.id);
  const fallback = f.db.data.floor_plans.find(
    (p) => p.propertyId === f.property.id && p.kind === "site",
  );
  assert.notEqual(fallback.id, original.id);
  assert.equal(fallback.id, defaultPlanId("site", f.property.id, 1));
  assert.equal(isUntouchedDefaultPlan(fallback), true);
  assert.equal(backfillDefaultPlans(f.db).created, 0);
});

test("Untouched defaults do not prevent deleting empty entities, custom drawings still do", (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const empty = f.db.createProperty({
    name: "Пустой",
    address: "Адрес",
    totalArea: 100,
    rentableArea: 90,
    warehouseClass: "A",
  });
  const building = saveStructure(f.db, "buildings", null, {
    propertyId: empty.id,
    name: "Удаляемый корпус",
  });
  assert.throws(() => f.db.deleteProperty(empty.id), /Нельзя удалить/);
  deleteStructure(f.db, "buildings", building.id);
  assert.equal(
    f.db.data.floor_plans.some((p) => p.buildingId === building.id),
    false,
  );
  assert.equal(f.db.deleteProperty(empty.id).changes, 1);
  assert.equal(
    f.db.data.floor_plans.some((p) => p.propertyId === empty.id),
    false,
  );
  const protectedBuilding = saveStructure(f.db, "buildings", null, {
    propertyId: f.property.id,
    name: "С чертежом",
  });
  const plan = f.db.data.floor_plans.find(
    (p) => p.buildingId === protectedBuilding.id,
  );
  saveOperation(
    f.db,
    f.admin,
    "floorplans",
    plan.id,
    input(f, {
      kind: "building",
      buildingId: protectedBuilding.id,
      version: 1,
    }),
  );
  assert.throws(
    () => deleteStructure(f.db, "buildings", protectedBuilding.id),
    /дочерние/,
  );
});
