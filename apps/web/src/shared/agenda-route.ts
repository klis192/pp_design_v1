import type { AgendaKind } from "../../../../packages/contracts/src/agenda";

export const agendaPeriods = ["7", "30", "60", "90"] as const;
export const agendaKinds = [
  "all",
  "lease",
  "payment",
  "maintenance",
  "ticket",
  "warranty",
] as const;
export type AgendaRoute = {
  days: (typeof agendaPeriods)[number];
  kind: AgendaKind | "all";
  propertyId: string;
};
export const agendaRouteKeys = [
  "agendaDays",
  "agendaKind",
  "agendaProperty",
] as const;

export function parseAgendaRoute(route: Record<string, string>): AgendaRoute {
  return {
    days: (agendaPeriods as readonly string[]).includes(route.agendaDays)
      ? (route.agendaDays as AgendaRoute["days"])
      : "30",
    kind: (agendaKinds as readonly string[]).includes(route.agendaKind)
      ? (route.agendaKind as AgendaRoute["kind"])
      : "all",
    // Availability belongs to the current scoped property list, not to URL syntax.
    propertyId: route.agendaProperty ?? "",
  };
}

export function serializeAgendaRoute(route: AgendaRoute) {
  return {
    agendaDays: route.days,
    agendaKind: route.kind,
    agendaProperty: route.propertyId,
  };
}
