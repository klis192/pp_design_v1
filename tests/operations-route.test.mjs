import assert from "node:assert/strict";
import test from "node:test";
import {
  agendaOperationsTarget,
  operationsRouteError,
  operationsTabs,
  parseOperationsRoute,
  serializeOperationsRoute,
} from "../apps/web/src/shared/operations-route.ts";
import {
  parseAgendaRoute,
  serializeAgendaRoute,
} from "../apps/web/src/shared/agenda-route.ts";
import {
  parseTicketFrom,
  ticketOriginForOpen,
  ticketOriginScreens,
} from "../apps/web/src/shared/ticket-route.ts";

test("Ticket return targets are allowlisted and nested detail links retain their origin", () => {
  for (const origin of ticketOriginScreens) {
    assert.equal(parseTicketFrom(origin), origin);
    assert.equal(ticketOriginForOpen(origin, "tickets"), origin);
    assert.equal(ticketOriginForOpen("ticket-detail", origin), origin);
    assert.equal(
      parseTicketFrom(
        new URLSearchParams({ ticketFrom: origin }).get("ticketFrom"),
      ),
      origin,
    );
  }
  for (const value of [
    undefined,
    null,
    "",
    "ticket-detail",
    "ticket-create",
    "property-add",
    "profile",
    "https://outside.test/",
  ])
    assert.equal(parseTicketFrom(value), "tickets");
});

test("Agenda keeps plan and equipment identities in their own typed routes", () => {
  assert.deepEqual(
    agendaOperationsTarget({
      kind: "maintenance",
      entityId: "plan-17",
      propertyId: "property-a",
    }),
    { tab: "plans", recordId: "plan-17", propertyId: "property-a" },
  );
  assert.deepEqual(
    agendaOperationsTarget({
      kind: "warranty",
      entityId: "equipment-12",
      propertyId: "property-b",
    }),
    { tab: "equipment", recordId: "equipment-12", propertyId: "property-b" },
  );
  for (const kind of ["ticket", "lease", "payment"])
    assert.equal(
      agendaOperationsTarget({ kind, entityId: "record", propertyId: "p" }),
      null,
    );
});

test("Operations URLs round-trip record and property without taking the tenant tab key", () => {
  const context = {
    tab: "plans",
    recordId: "plan-17",
    propertyId: "property-a",
  };
  const params = serializeOperationsRoute(context);
  assert.equal(Object.hasOwn(params, "tab"), false);
  assert.deepEqual(
    parseOperationsRoute(Object.fromEntries(new URLSearchParams(params))),
    context,
  );
  assert.equal(
    parseOperationsRoute({ ...params, tab: "payments" }).tab,
    "plans",
  );
});

test("Explicit unknown or administrative tabs remain refused across URL round-trips", () => {
  for (const operationsTab of ["users", "access", "audit", "unknown", ""]) {
    const route = parseOperationsRoute({ operationsTab });
    assert.equal(route.tab, operationsTab);
    assert.match(operationsRouteError(route), /Раздел из ссылки/);
    assert.deepEqual(
      parseOperationsRoute(serializeOperationsRoute(route)),
      route,
    );
  }
  assert.deepEqual(parseOperationsRoute({}), {
    tab: "equipment",
    recordId: "",
    propertyId: "",
  });
  assert.equal(
    parseOperationsRoute({ operationsTab: "plans", operation: "not-found" })
      .recordId,
    "not-found",
    "Missing records remain explicit targets; they are not silently replaced",
  );
  assert.equal(operationsRouteError(parseOperationsRoute({})), "");
});

test("Only plan/equipment record targets are supported; other tabs keep their ordinary lists", () => {
  for (const tab of operationsTabs) {
    const list = { tab, recordId: "", propertyId: "" };
    assert.equal(operationsRouteError(list), "");
    const target = { ...list, recordId: "record-17" };
    if (["plans", "equipment"].includes(tab))
      assert.equal(operationsRouteError(target), "");
    else
      assert.match(
        operationsRouteError(target),
        /Запись по этой ссылке недоступна/,
      );
    assert.deepEqual(
      parseOperationsRoute(serializeOperationsRoute(target)),
      target,
    );
  }
  for (const tab of ["templates", "materials", "contractors", "estimates"])
    assert.match(
      operationsRouteError({ tab, recordId: "", propertyId: "property-a" }),
      /Не удалось открыть выбранный объект/,
    );
});

test("Agenda filters round-trip independently and validate period/type", () => {
  const context = { days: "90", kind: "maintenance", propertyId: "property-a" };
  assert.deepEqual(parseAgendaRoute(serializeAgendaRoute(context)), context);
  assert.deepEqual(
    parseAgendaRoute({
      agendaDays: "9000",
      agendaKind: "unknown",
      agendaProperty: "unavailable",
    }),
    { days: "30", kind: "all", propertyId: "unavailable" },
    "An unavailable property stays explicit so the UI can refuse instead of showing every property",
  );
  assert.equal(Object.hasOwn(serializeAgendaRoute(context), "tab"), false);
  assert.equal(Object.hasOwn(serializeAgendaRoute(context), "property"), false);
});
