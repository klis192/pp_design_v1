import type { PlanGeometry } from "./operations-platform.ts";

export const DEFAULT_PLAN_SOURCE = "default-square.dxf";
export const DEFAULT_PLAN_LAYER = "BUILDING";

/** A schematic outline only: coordinates do not claim measured building size. */
export function createDefaultPlanGeometry(): PlanGeometry {
  return [
    {
      id: "building-outline",
      layer: DEFAULT_PLAN_LAYER,
      type: "polygon",
      points: [
        { x: 100, y: 100 },
        { x: 900, y: 100 },
        { x: 900, y: 900 },
        { x: 100, y: 900 },
      ],
    },
  ];
}
