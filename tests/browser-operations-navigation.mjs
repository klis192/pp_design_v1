import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { fixture } from "./fixtures.mjs";
import { getAgenda } from "../apps/api/src/agenda.js";
import {
  getOperations,
  publicUser,
  runMaintenance,
  saveOperation,
} from "../apps/api/src/operations.js";
import { createNormalizersService } from "../apps/api/src/services/normalizers.js";

// The actual built UI runs against controlled HTTP/WS fixtures, never a deployed API.
const f = fixture();
const n = createNormalizersService({});
const equipment = saveOperation(f.db, f.admin, "equipment", null, {
  propertyId: f.property.id,
  unitId: f.unit.id,
  name: "Навигация: оборудование",
  type: "Вентиляция",
  serialNumber: "NAV-1",
  status: "active",
  cost: 100,
  responsibleId: f.worker.id,
  warrantyUntil: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
});
const plan = saveOperation(f.db, f.admin, "plans", null, {
  propertyId: f.property.id,
  unitId: f.unit.id,
  equipmentId: equipment.id,
  name: "Навигация: график ППР",
  recurrence: "days",
  intervalCount: 1,
  nextDate: new Date().toISOString().slice(0, 10),
  responsibleId: f.worker.id,
  checklist: ["Осмотреть"],
  active: true,
});
runMaintenance(f.db);
const task = f.db.data.tickets.find((t) => t.maintenance_plan_id === plan.id);
assert.ok(task, "Fixture has a real issued task for its plan");
const overview = {
  totals: {
    property_count: 2,
    total_rentable_area: 1800,
    unit_count: 2,
    occupied_area: 300,
    vacant_area: 1500,
    tenant_count: 1,
    active_lease_count: 2,
  },
  occupancyRate: 16.7,
  expiringLeaseCount: 0,
  properties: f.db.data.properties.map(n.normalizeProperty),
  units: f.db.data.units.map(n.normalizeUnit),
  tenants: f.db.data.tenants.map(n.normalizeTenant),
  leases: f.db.data.leases.map(n.normalizeLease),
  finance: {
    collectionBilled: 0,
    collectionPaid: 0,
    collectionRate: 0,
    arrearsAmount: 0,
    opexRatio: 0,
    noi: 0,
    forecastQuarter: 0,
    series: [],
  },
  notifications: [],
  team: [],
  exports: [],
};
const cursor = { epoch: "00000000-0000-4000-8000-000000000001", revision: "0" };
const dist = path.resolve("apps/web/dist");
assert.ok(
  fs.existsSync(path.join(dist, "index.html")),
  "Build web before running this test",
);
const server = http.createServer((req, res) => {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  let file = path.resolve(dist, "." + requestPath);
  if (!file.startsWith(dist + path.sep) && file !== dist) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(dist, "index.html");
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html",
  );
  res.end(fs.readFileSync(file));
});
let browser;
const errors = [],
  writes = [],
  checks = [];
let socket,
  holdAgenda = false,
  agendaHeld = false,
  releaseAgenda;
let agendaGate = Promise.resolve();
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("warehouse-platform-token", "browser-only-fixture"),
  );
  await page.routeWebSocket("**/api/realtime", (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      if (JSON.parse(message).type === "authenticate")
        ws.send(
          JSON.stringify({ type: "ready", protocol: 1, cursor, resources: [] }),
        );
      else ws.send(JSON.stringify({ type: "state", cursor }));
    });
  });
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization,content-type",
        },
      });
    if (req.method() !== "GET") {
      writes.push(url.pathname);
      return route.abort();
    }
    let data = { items: [] };
    if (url.pathname === "/api/auth/me") data = { user: publicUser(f.admin) };
    if (url.pathname === "/api/dashboard/overview") data = overview;
    if (url.pathname === "/api/operations") data = getOperations(f.db, f.admin);
    if (url.pathname === "/api/tickets")
      data = { items: f.db.data.tickets.map(n.normalizeTicket) };
    if (url.pathname === "/api/agenda") {
      data = getAgenda(f.db, f.admin, {
        days: Number(url.searchParams.get("days") || 30),
        propertyId: url.searchParams.get("propertyId") || undefined,
      });
      if (holdAgenda) {
        agendaHeld = true;
        await agendaGate;
      }
    }
    if (url.pathname === "/api/realtime/state") data = { cursor };
    if (url.pathname === "/api/maintenance")
      data = {
        templates: [],
        materials: [],
        contractors: [],
        estimates: [],
        estimateTicketIds: [],
        acts: [],
      };
    if (url.pathname === "/api/maintenance/progress")
      data = {
        items: [],
        summary: { planned: 0, completed: 0, overdue: 0, rescheduled: 0 },
      };
    if (url.pathname.endsWith("/workflow"))
      data = {
        item: null,
        decisions: [],
        capabilities: {
          approve: false,
          accept: false,
          execute: false,
          terms: false,
        },
      };
    if (url.pathname === "/api/accounting")
      data = { sources: [], accounts: [], statements: [], links: [] };
    return route.fulfill({
      json: data,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(origin + "/#screen=agenda");
  const planEvent = page.locator(".agenda-item").filter({
    has: page.getByRole("heading", { name: plan.name, exact: true }),
  });
  await planEvent.waitFor();
  const before = await planEvent.boundingBox();
  await page.waitForTimeout(200);
  agendaGate = new Promise((resolve) => (releaseAgenda = resolve));
  holdAgenda = true;
  socket.send(
    JSON.stringify({
      type: "invalidate",
      cursor: { ...cursor, revision: "1" },
      resources: ["agenda"],
    }),
  );
  for (let i = 0; !agendaHeld && i < 60; i++) await page.waitForTimeout(25);
  assert.ok(agendaHeld);
  assert.equal(
    await page.getByText("Загрузка сроков…", { exact: true }).count(),
    0,
  );
  assert.ok(Math.abs((await planEvent.boundingBox()).y - before.y) < 1);
  holdAgenda = false;
  releaseAgenda();
  checks.push(
    "Delayed Agenda refresh keeps its content and does not add a loading line",
  );
  await page.getByLabel("Период", { exact: true }).selectOption("90");
  await page
    .getByLabel("Тип события", { exact: true })
    .selectOption("maintenance");
  await page.getByLabel("Объект", { exact: true }).selectOption(f.property.id);
  await page.reload();
  await planEvent.waitFor();
  assert.equal(
    await page.getByLabel("Период", { exact: true }).inputValue(),
    "90",
  );
  assert.equal(
    await page.getByLabel("Тип события", { exact: true }).inputValue(),
    "maintenance",
  );
  assert.equal(
    await page.getByLabel("Объект", { exact: true }).inputValue(),
    f.property.id,
  );
  await planEvent
    .getByRole("button", { name: "Открыть раздел", exact: true })
    .click();
  await page
    .locator(".operation-detail")
    .getByRole("heading", { name: plan.name, exact: true })
    .waitFor();
  let route = new URLSearchParams(new URL(page.url()).hash.slice(1));
  assert.equal(route.get("operationsTab"), "plans");
  assert.equal(route.get("operation"), plan.id);
  assert.equal(route.get("operationsProperty"), f.property.id);
  checks.push("Agenda opens the exact plan in its property");
  await page.reload();
  await page
    .locator(".operation-detail")
    .getByRole("heading", { name: plan.name, exact: true })
    .waitFor();
  await page
    .locator(".operation-detail")
    .getByRole("button", { name: /^Показать Задания и история выполнения/ })
    .click();
  await page
    .locator(".operation-detail")
    .getByRole("button", { name: new RegExp(task.title), exact: false })
    .click();
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("ticket"),
    task.id,
  );
  await page.goBack();
  await page
    .locator(".operation-detail")
    .getByRole("heading", { name: plan.name, exact: true })
    .waitFor();
  await page.goBack();
  await page
    .getByRole("heading", { name: "Сроки и работы", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Период", { exact: true }).inputValue(),
    "90",
  );
  assert.equal(
    await page.getByLabel("Тип события", { exact: true }).inputValue(),
    "maintenance",
  );
  assert.equal(
    await page.getByLabel("Объект", { exact: true }).inputValue(),
    f.property.id,
  );
  await page.goForward();
  await page
    .locator(".operation-detail")
    .getByRole("heading", { name: plan.name, exact: true })
    .waitFor();
  checks.push("Plan reload and task Back/Forward preserve the selected record");
  await page.goBack();
  await page
    .getByLabel("Тип события", { exact: true })
    .selectOption("warranty");
  const warranty = page.locator(".agenda-item").filter({
    has: page.getByRole("heading", {
      name: `Гарантия: ${equipment.name}`,
      exact: true,
    }),
  });
  await warranty
    .getByRole("button", { name: "Открыть раздел", exact: true })
    .click();
  await page
    .locator(".operation-detail")
    .getByRole("heading", { name: equipment.name, exact: true })
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("operationsTab"),
    "equipment",
  );
  checks.push("Warranty opens its equipment instead of the default list");
  await page
    .locator(".operations-nav")
    .getByRole("button", { name: "ППР", exact: true })
    .click();
  await page
    .locator(".operations-subnav")
    .getByRole("button", { name: "Регламенты", exact: true })
    .click();
  await page.getByLabel("Поиск в справочнике", { exact: true }).waitFor();
  route = new URLSearchParams(new URL(page.url()).hash.slice(1));
  assert.equal(route.get("operationsTab"), "templates");
  assert.equal(route.get("operation"), "");
  assert.equal(route.get("operationsProperty"), "");
  for (const operationsTab of ["unknown", "users", "access", "audit", ""]) {
    await page.goto(
      origin + "/#screen=operations&operationsTab=" + operationsTab,
    );
    await page
      .getByRole("alert")
      .filter({ hasText: "Раздел из ссылки не найден или недоступен." })
      .waitFor();
    assert.equal(
      await page
        .locator(".operations-nav, .operation-detail, .platform-section")
        .count(),
      0,
    );
    assert.equal(
      new URLSearchParams(new URL(page.url()).hash.slice(1)).get(
        "operationsTab",
      ),
      operationsTab,
    );
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "Раздел из ссылки не найден или недоступен." })
      .waitFor();
    assert.equal(
      new URLSearchParams(new URL(page.url()).hash.slice(1)).get(
        "operationsTab",
      ),
      operationsTab,
    );
  }
  checks.push(
    "Explicit unknown/admin tabs keep their refusal and original target after reload",
  );
  for (const operationsTab of [
    "templates",
    "materials",
    "contractors",
    "estimates",
    "services",
    "meters",
    "news",
    "expenses",
  ]) {
    await page.goto(
      origin +
        `/#screen=operations&operationsTab=${operationsTab}&operation=target-record&operationsProperty=${f.property.id}`,
    );
    await page
      .getByRole("alert")
      .filter({
        hasText: "Запись по этой ссылке недоступна.",
      })
      .waitFor();
    assert.equal(
      await page
        .locator(".operations-nav, .operation-detail, .platform-section")
        .count(),
      0,
    );
    route = new URLSearchParams(new URL(page.url()).hash.slice(1));
    assert.equal(route.get("operation"), "target-record");
    assert.equal(route.get("operationsProperty"), f.property.id);
    await page.reload();
    await page
      .getByRole("alert")
      .filter({
        hasText: "Запись по этой ссылке недоступна.",
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Открыть список раздела", exact: true })
      .click();
    await page.locator(".operations-nav").waitFor();
    assert.equal(
      await page.locator(".operations-page [role=alert]").count(),
      0,
    );
    route = new URLSearchParams(new URL(page.url()).hash.slice(1));
    assert.equal(route.get("operationsTab"), operationsTab);
    assert.equal(route.get("operation"), "");
    assert.equal(route.get("operationsProperty"), "");
  }
  for (const operationsTab of [
    "templates",
    "materials",
    "contractors",
    "estimates",
  ]) {
    await page.goto(
      origin +
        `/#screen=operations&operationsTab=${operationsTab}&operationsProperty=${f.property.id}`,
    );
    await page
      .getByRole("alert")
      .filter({
        hasText: "Не удалось открыть выбранный объект.",
      })
      .waitFor();
    assert.equal(await page.locator(".platform-section").count(), 0);
  }
  checks.push(
    "Unsupported record/property targets are refused; ordinary list navigation and explicit recovery still work",
  );
  await page.goto(
    origin +
      "/#screen=operations&operationsTab=plans&operation=not-found&operationsProperty=" +
      f.property.id,
  );
  await page
    .getByText("Запись не найдена или недоступна в выбранном контексте.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".operation-detail").count(), 0);
  await page.goto(
    origin +
      `/#screen=operations&operationsTab=plans&operation=${plan.id}&operationsProperty=${f.other.id}`,
  );
  await page
    .getByText("Запись не найдена или недоступна в выбранном контексте.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".operation-detail").count(), 0);
  checks.push(
    "Unknown record and mismatched property do not open a fallback record",
  );
  await page.goto(
    origin +
      "/#screen=agenda&agendaDays=90&agendaKind=maintenance&agendaProperty=unavailable",
  );
  await page
    .getByText(
      "Объект календаря недоступен. Выберите другой доступный объект.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await page.locator(".agenda-item").count(), 0);
  assert.equal(
    await page.getByLabel("Объект", { exact: true }).inputValue(),
    "unavailable",
  );
  checks.push(
    "An unavailable Agenda property does not silently fall back to all properties",
  );
  await page.goto(origin + "/#screen=dashboard");
  const dashboard = page.locator(".dashboard-workspace");
  await dashboard
    .getByRole("heading", { name: "Открытые заявки", exact: true })
    .waitFor();
  await dashboard.getByLabel("Поиск", { exact: true }).fill(task.title);
  await dashboard
    .getByLabel("Объект", { exact: true })
    .selectOption(f.property.id);
  await dashboard.locator(".dashboard-ticket-list > button").first().click();
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("ticketFrom"),
    "dashboard",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("ticketFrom"),
    "dashboard",
  );
  await page.locator(".mvp-detail-head .mvp-back").click();
  await dashboard.waitFor();
  assert.equal(
    await dashboard.getByLabel("Поиск", { exact: true }).inputValue(),
    task.title,
  );
  assert.equal(
    await dashboard.getByLabel("Объект", { exact: true }).inputValue(),
    f.property.id,
  );
  await page.goBack();
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("ticketFrom"),
    "dashboard",
  );
  await page.goForward();
  await dashboard.waitFor();
  assert.equal(
    await dashboard.getByLabel("Поиск", { exact: true }).inputValue(),
    task.title,
  );
  checks.push(
    "Ticket UI-back, reload and browser Back/Forward retain the dashboard origin and its filters",
  );
  await page.goto(origin + "/#screen=ticket-detail&ticket=" + task.id);
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("ticketFrom"),
    "tickets",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: task.title, exact: true })
    .first()
    .waitFor();
  await page.locator(".mvp-detail-head .mvp-back").click();
  await page.getByRole("heading", { name: "Заявки", exact: true }).waitFor();
  assert.equal(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).get("screen"),
    "tickets",
  );
  checks.push(
    "A legacy direct ticket link returns to the real tickets list after reload without using external history",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    JSON.stringify({
      status: "passed",
      checks,
      boundary:
        "Actual built React UI; controlled local HTTP/WS fixtures, no PostgreSQL, 1C or production.",
    }),
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  assert.ok(
    path
      .resolve(f.dir)
      .startsWith(path.resolve(os.tmpdir()) + path.sep + "wirehouse-test-"),
  );
  f.cleanup();
}
