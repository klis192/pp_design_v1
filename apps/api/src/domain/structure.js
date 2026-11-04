import crypto from "node:crypto";
import { assertPlanUnitLocations } from "./plan-location-scope.js";
import {
  ensureDefaultBuildingPlan,
  isUntouchedDefaultPlan,
} from "./default-floor-plans.js";

// Unit labels are a read projection. Stable floor IDs own the location relation.
export function locationForUnit(db, propertyId, input) {
  if (input.floorId) {
    const floor = db.getById("floors", input.floorId);
    if (!floor || floor.propertyId !== propertyId)
      throw new Error("Этаж не принадлежит объекту");
    const entrance = db.getById("entrances", floor.entranceId);
    const building = db.getById("buildings", entrance.buildingId);
    return {
      floor_id: floor.id,
      building: building.name,
      entrance: entrance.name,
      floor: floor.number,
    };
  }
  const buildingName = String(input.building ?? "").trim();
  const entranceName = String(input.entrance ?? "").trim();
  const now = new Date().toISOString();
  function ensure(table, predicate, fields) {
    let row = db.data[table].find(predicate);
    if (!row) {
      row = {
        id: crypto.randomUUID(),
        propertyId,
        ...fields,
        createdAt: now,
        updatedAt: now,
      };
      db.data[table].push(row);
    }
    return row;
  }
  const building = ensure(
    "buildings",
    (b) => b.propertyId === propertyId && b.name === buildingName,
    { name: buildingName },
  );
  ensureDefaultBuildingPlan(db, building);
  const entrance = ensure(
    "entrances",
    (e) => e.buildingId === building.id && e.name === entranceName,
    { buildingId: building.id, name: entranceName },
  );
  const number = Number(input.floor);
  const floor = ensure(
    "floors",
    (f) => f.entranceId === entrance.id && f.number === number,
    { entranceId: entrance.id, number, name: `Этаж ${number}` },
  );
  return {
    floor_id: floor.id,
    building: building.name,
    entrance: entrance.name,
    floor: floor.number,
  };
}

export function saveStructure(db, kind, id, body) {
  const current = id ? db.getById(kind, id) : null;
  if (id && !current)
    throw Object.assign(new Error("Узел не найден"), { status: 404 });
  if (current && body.updatedAt !== current.updatedAt)
    throw Object.assign(
      new Error("Структура уже изменена. Обновите страницу."),
      { status: 409 },
    );
  const input = { ...current, ...body };
  db.requireProperty(input.propertyId);
  if (current && input.propertyId !== current.propertyId)
    throw new Error("Перенос между объектами запрещён");
  if (
    kind === "entrances" &&
    db.getById("buildings", input.buildingId)?.propertyId !== input.propertyId
  )
    throw new Error("Корпус другого объекта");
  if (
    kind === "floors" &&
    db.getById("entrances", input.entranceId)?.propertyId !== input.propertyId
  )
    throw new Error("Подъезд другого объекта");
  if (
    db.data[kind].some(
      (r) =>
        r.id !== id &&
        (kind === "buildings"
          ? r.propertyId === input.propertyId && r.name === input.name
          : kind === "entrances"
            ? r.buildingId === input.buildingId && r.name === input.name
            : r.entranceId === input.entranceId && r.number === input.number),
    )
  )
    throw new Error("Узел уже существует в этом родителе");
  if (current && ["entrances", "floors"].includes(kind)) {
    const nextBuildingId =
      kind === "entrances"
        ? input.buildingId
        : db.getById("entrances", input.entranceId).buildingId;
    const movedUnits = new Map(
      db.data.units
        .filter((unit) => {
          const floor = db.getById("floors", unit.floor_id);
          const entrance = db.getById("entrances", floor.entranceId);
          return (
            entrance.buildingId !== nextBuildingId &&
            (kind === "entrances"
              ? floor.entranceId === current.id
              : floor.id === current.id)
          );
        })
        .map((unit) => [
          unit.id,
          { floorId: unit.floor_id, buildingId: nextBuildingId },
        ]),
    );
    assertPlanUnitLocations(db, movedUnits);
  }
  const now = new Date().toISOString();
  const row = {
    ...input,
    id: id || crypto.randomUUID(),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  if (current) Object.assign(current, row);
  else db.data[kind].push(row);
  if (kind === "buildings") ensureDefaultBuildingPlan(db, row);
  for (const unit of db.data.units.filter(
    (u) => u.property_id === row.propertyId,
  ))
    Object.assign(
      unit,
      locationForUnit(db, unit.property_id, { floorId: unit.floor_id }),
    );
  for (const plan of db.data.floor_plans.filter(
    (p) => p.propertyId === row.propertyId && p.floorId,
  )) {
    const floor = db.getById("floors", plan.floorId);
    const buildingId = db.getById("entrances", floor.entranceId).buildingId;
    if (plan.buildingId !== buildingId)
      Object.assign(plan, {
        buildingId,
        version: (plan.version ?? 0) + 1,
        updatedAt: now,
      });
  }
  return row;
}

export function deleteStructure(db, kind, id) {
  const dependencies =
    kind === "buildings"
      ? db.data.entrances.some((e) => e.buildingId === id) ||
        db.data.floor_plans.some(
          (p) => p.buildingId === id && !isUntouchedDefaultPlan(p),
        )
      : kind === "entrances"
        ? db.data.floors.some((f) => f.entranceId === id)
        : db.data.units.some((u) => u.floor_id === id) ||
          db.data.floor_plans.some((p) => p.floorId === id);
  if (dependencies)
    throw Object.assign(
      new Error("Сначала перенесите или удалите дочерние записи"),
      { status: 409 },
    );
  db.data[kind] = db.data[kind].filter((r) => r.id !== id);
  if (kind === "buildings")
    db.data.floor_plans = db.data.floor_plans.filter(
      (p) => p.buildingId !== id,
    );
}
