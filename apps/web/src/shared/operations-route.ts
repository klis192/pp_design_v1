import type { AgendaItemDto } from "../../../../packages/contracts/src/agenda";

export const operationsTabs = [
  "equipment",
  "plans",
  "templates",
  "services",
  "materials",
  "contractors",
  "meters",
  "news",
  "expenses",
  "estimates",
] as const;

export type OperationsTab = (typeof operationsTabs)[number];
export type OperationsRoute = {
  // URL input stays intact until validation; an invalid tab is never another entity.
  tab: string;
  recordId: string;
  propertyId: string;
};

export const operationsRouteKeys = [
  "operationsTab",
  "operation",
  "operationsProperty",
] as const;

export function isOperationsTab(value: string): value is OperationsTab {
  return (operationsTabs as readonly string[]).includes(value);
}

export function supportsOperationsRecord(tab: string) {
  return tab === "plans" || tab === "equipment";
}

export function supportsOperationsProperty(tab: string) {
  return !["templates", "materials", "contractors", "estimates"].includes(tab);
}

export function operationsRouteError(route: OperationsRoute) {
  if (!isOperationsTab(route.tab))
    return "Раздел из ссылки не найден или недоступен. Выберите доступный раздел.";
  if (route.recordId && !supportsOperationsRecord(route.tab))
    return "Запись по этой ссылке недоступна. Откройте список и выберите нужную запись.";
  if (route.propertyId && !supportsOperationsProperty(route.tab))
    return "Не удалось открыть выбранный объект. Откройте список и выберите нужную запись.";
  return "";
}

export function parseOperationsRoute(
  route: Record<string, string>,
): OperationsRoute {
  return {
    tab: route.operationsTab ?? "equipment",
    recordId: route.operation ?? "",
    propertyId: route.operationsProperty ?? "",
  };
}

export function serializeOperationsRoute(route: OperationsRoute) {
  return {
    operationsTab: route.tab,
    operation: route.recordId,
    operationsProperty: route.propertyId,
  };
}

export function agendaOperationsTarget(
  item: Pick<AgendaItemDto, "kind" | "entityId" | "propertyId">,
): OperationsRoute | null {
  if (item.kind !== "maintenance" && item.kind !== "warranty") return null;
  return {
    tab: item.kind === "maintenance" ? "plans" : "equipment",
    recordId: item.entityId,
    propertyId: item.propertyId,
  };
}
