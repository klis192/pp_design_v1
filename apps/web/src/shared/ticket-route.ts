export const ticketOriginScreens = [
  "dashboard",
  "tickets",
  "agenda",
  "objects",
  "units",
  "unit-detail",
  "tenant-detail",
  "chat",
  "notifications",
  "operations",
  "billing",
] as const;

export type TicketOrigin = (typeof ticketOriginScreens)[number];

export function parseTicketFrom(value: unknown): TicketOrigin {
  return typeof value === "string" &&
    (ticketOriginScreens as readonly string[]).includes(value)
    ? (value as TicketOrigin)
    : "tickets";
}

export function ticketOriginForOpen(screen: string, previous: TicketOrigin) {
  return parseTicketFrom(screen === "ticket-detail" ? previous : screen);
}
