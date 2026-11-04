import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  createDefaultPlanGeometry,
  DEFAULT_PLAN_LAYER,
  DEFAULT_PLAN_SOURCE,
} from "../../../../packages/contracts/src/floor-plans.ts";

export function defaultPlanId(kind, entityId, attempt = 0) {
  const hex = crypto
    .createHash("md5")
    .update(
      `wirehouse:default-floorplan:${kind}:${entityId}${attempt ? `:${attempt}` : ""}`,
    )
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUntouchedDefaultPlan(plan) {
  const kind = plan.kind;
  const entityId = kind === "building" ? plan.buildingId : plan.propertyId;
  return (
    ["site", "building"].includes(kind) &&
    Boolean(entityId) &&
    plan.isDefault === true &&
    plan.version === 1 &&
    !plan.createdBy &&
    !plan.floorId &&
    (kind === "building" ? Boolean(plan.buildingId) : !plan.buildingId) &&
    plan.sourceName === DEFAULT_PLAN_SOURCE &&
    !plan.image &&
    plan.name === (kind === "building" ? "План здания" : "План объекта") &&
    isDeepStrictEqual(plan.geometry, createDefaultPlanGeometry()) &&
    isDeepStrictEqual(plan.layers, [DEFAULT_PLAN_LAYER]) &&
    isDeepStrictEqual(plan.markers, [])
  );
}

export function hasMeaningfulPlan(plan) {
  return Boolean(
    (Array.isArray(plan.geometry) && plan.geometry.length) ||
    String(plan.image ?? "").trim() ||
    (Array.isArray(plan.markers) && plan.markers.length),
  );
}

/** Called only inside explicit domain write transactions, never by a read. */
export function ensureDefaultSitePlan(db, propertyId) {
  db.requireProperty(propertyId);
  return ensure(db, "site", propertyId, null);
}

export function ensureDefaultBuildingPlan(db, building) {
  db.requireProperty(building.propertyId);
  return ensure(db, "building", building.propertyId, building.id);
}

function ensure(db, kind, propertyId, buildingId) {
  const existing = db.data.floor_plans.find(
    (row) =>
      row.propertyId === propertyId &&
      !row.floorId &&
      (row.kind ?? "site") === kind &&
      (row.buildingId ?? null) === buildingId &&
      hasMeaningfulPlan(row),
  );
  if (existing) return existing;
  let id;
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = defaultPlanId(kind, buildingId ?? propertyId, attempt);
    if (!db.data.floor_plans.some((row) => row.id === candidate)) {
      id = candidate;
      break;
    }
  }
  if (!id) throw new Error("Идентификатор базового плана уже занят");
  const stamp = new Date().toISOString();
  const row = {
    id,
    propertyId,
    buildingId,
    floorId: null,
    kind,
    name: kind === "building" ? "План здания" : "План объекта",
    image: "",
    geometry: createDefaultPlanGeometry(),
    layers: [DEFAULT_PLAN_LAYER],
    markers: [],
    sourceName: DEFAULT_PLAN_SOURCE,
    isDefault: true,
    version: 1,
    createdBy: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.data.floor_plans.push(row);
  return row;
}

export function backfillDefaultPlans(db) {
  return db.transaction(() => {
    const before = db.data.floor_plans.length;
    for (const property of db.data.properties)
      ensureDefaultSitePlan(db, property.id);
    for (const building of db.data.buildings)
      ensureDefaultBuildingPlan(db, building);
    return { created: db.data.floor_plans.length - before };
  });
}
