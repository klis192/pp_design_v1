/** Validate future unit locations before moving a unit or its parent structure.
 * A whole floor keeps its own plan; a building plan cannot keep units that left.
 */
export function assertPlanUnitLocations(db, locations) {
  if (!locations.size) return;
  const invalid = (unitId, plan) => {
    const next = locations.get(unitId);
    if (!next) return false;
    if (plan.floorId) return plan.floorId !== next.floorId;
    return Boolean(plan.buildingId && plan.buildingId !== next.buildingId);
  };
  const blocked = db.data.floor_plans.some(
    (plan) =>
      (plan.floorId || plan.buildingId) &&
      ((plan.markers ?? []).some((marker) => invalid(marker.unitId, plan)) ||
        (plan.geometry ?? []).some(
          (shape) =>
            invalid(shape.unitId, plan) ||
            (shape.equipmentId &&
              invalid(
                db.getById("equipment", shape.equipmentId)?.unitId,
                plan,
              )),
        )),
  );
  if (blocked)
    throw Object.assign(
      new Error(
        "Помещения используются на плане этажа или корпуса. Сначала измените их привязки на плане, затем повторите перенос.",
      ),
      { status: 409 },
    );
}
