import type {
  FloorPlan,
  Structure,
} from "../../../../../../../packages/contracts/src/operations-platform";

export function planContextLabel(plan: FloorPlan, structure: Structure) {
  if (plan.kind === "site") return `Генплан · ${plan.name}`;
  const floor = structure.floors.find((item) => item.id === plan.floorId);
  const entrance = structure.entrances.find(
    (item) => item.id === floor?.entranceId,
  );
  const building = structure.buildings.find(
    (item) => item.id === (plan.buildingId ?? entrance?.buildingId),
  );
  const parts: string[] = [];
  if (building) {
    parts.push(
      !building.name
        ? "Корпус не указан"
        : building.name.toLocaleLowerCase("ru").startsWith("корпус")
          ? building.name
          : `Корпус ${building.name}`,
    );
  }
  if (floor) parts.push(`Этаж ${floor.number}`);
  parts.push(plan.name);
  return parts.join(" · ");
}
