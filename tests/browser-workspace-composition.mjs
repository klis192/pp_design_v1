import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin =
  process.env.WAREHOUSE_UI_ORIGIN ?? "http://wirehouse.localhost:5186";
const parsedOrigin = new URL(origin);
assert.ok(
  ["localhost", "127.0.0.1", "wirehouse.localhost"].includes(
    parsedOrigin.hostname,
  ),
);
assert.equal(parsedOrigin.protocol, "http:");
const sessionPath =
  process.env.WAREHOUSE_UI_SESSION ??
  ".local/ux-2026-11-04/preview-session.json";
const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
assert.equal(session.environment, "test", "Use the isolated fixture session");
assert.equal(session.purpose, "ux-review-20261104");
const output = path.resolve(
  process.env.WAREHOUSE_UI_EVIDENCE ??
    ".local/ux-2026-11-04/composition-2/final",
);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const checks = [],
  errors = [],
  writes = [];
let page;
async function contextFor(token) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "ru-RU",
    timezoneId: "Asia/Yekaterinburg",
  });
  context.setDefaultTimeout(15000);
  await context.addInitScript((value) => {
    if (location.protocol === "http:")
      localStorage.setItem("warehouse-platform-token", value);
  }, token);
  await context.route("**/api/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      writes.push({
        method: route.request().method(),
        path: new URL(route.request().url()).pathname,
      });
      return route.abort();
    }
    await route.continue();
  });
  context.on("page", (opened) =>
    opened.on("pageerror", (error) => errors.push(error.message)),
  );
  return context;
}
async function settled() {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll('[role="status"]')).some(
        (element) =>
          element.textContent?.trim() === "Загружаем данные…" &&
          element.getClientRects().length > 0,
      ),
  );
  await page
    .getByText("Загрузка сроков…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => !document.querySelector('.register-loading, [aria-busy="true"]'),
  );
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  assert.equal(
    await page.locator(".banner--error").count(),
    0,
    "No global error",
  );
}
async function inspect(name, capture = false) {
  await settled();
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scroll <= dimensions.width + 1,
    `${name}: document overflow`,
  );
  assert.equal(
    await page
      .getByRole("button", { name: /^(Показать|Скрыть)(\s|$)/ })
      .count(),
    0,
    `${name}: hidden function toggle`,
  );
  const icons = await page
    .locator("button.ui-icon-button")
    .evaluateAll((items) =>
      items
        .filter(
          (item) => item.getClientRects().length && !item.closest("[hidden]"),
        )
        .map((item) => ({
          label: item.getAttribute("aria-label"),
          title: item.title,
          width: item.getBoundingClientRect().width,
          height: item.getBoundingClientRect().height,
          text: item.innerText.trim(),
          svg: !!item.querySelector("svg"),
        })),
    );
  for (const icon of icons) {
    assert.ok(icon.label && icon.title && icon.svg, `${name}: icon semantics`);
    assert.ok(
      icon.width >= (dimensions.width <= 760 ? 44 : 36),
      `${name}: icon target`,
    );
    assert.ok(
      icon.width <= (dimensions.width <= 760 ? 44 : 36) + 1,
      `${name}: icon grows`,
    );
  }
  checks.push({
    name,
    width: dimensions.width,
    icons: icons.length,
    passed: true,
  });
  if (capture)
    await page.screenshot({ path: path.join(output, name + ".png") });
}
async function sweepTabs(screen, width, depth = 0, prefix = screen) {
  if (depth >= 3) return;
  const lists = page.getByRole("tablist");
  if ((await lists.count()) <= depth) {
    await inspect(`${prefix}-${width}`, depth === 0);
    return;
  }
  const list = lists.nth(depth);
  const length = await list.getByRole("tab").count();
  for (let index = 0; index < length; index++) {
    const tab = page
      .getByRole("tablist")
      .nth(depth)
      .getByRole("tab")
      .nth(index);
    if (await tab.isDisabled()) continue;
    await tab.click();
    assert.equal(await tab.getAttribute("aria-selected"), "true");
    const label = (await tab.innerText()).replace(/\s+/g, " ");
    await inspect(
      `${prefix}-tab${index}-${width}`,
      [1440, 390].includes(width) && depth === 0,
    );
    await sweepTabs(screen, width, depth + 1, `${prefix}-tab${index}`);
    checks.at(-1).selectedLabel = label;
  }
}
try {
  const admin = await contextFor(session.token);
  page = await admin.newPage();
  const screens = [
    "dashboard",
    "tickets",
    "objects",
    "units",
    "tenants",
    "leases",
    "billing",
    "chat",
    "agenda",
    "operations",
    "notifications",
    "staff",
    "import",
    "profile",
  ];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const screen of screens) {
      await page.goto(`${origin}/#screen=${screen}`);
      await page.locator(".mvp-main .mvp-page").waitFor();
      await settled();
      if (screen === "dashboard" && width === 1440) {
        assert.equal(
          await page
            .getByRole("button", { name: "Другие разделы", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await page.locator(".mvp-sidebar .mvp-nav-button").count(),
          14,
        );
      }
      await sweepTabs(screen, width);
    }
    console.log(`14 workspaces and their tabs checked at ${width}`);
  }
  const ticket = session.fixture.tickets[0];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.goto(
      `${origin}/#screen=ticket-detail&ticket=${ticket.id}&ticketFrom=dashboard`,
    );
    await page.locator(".ticket-record-header").waitFor();
    await sweepTabs("ticket-record", width);
    await page.getByRole("tab", { name: /^Работа/ }).click();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    const actualScroll = await page.evaluate(() => scrollY);
    const box = await page.locator(".ticket-record-header").boundingBox();
    assert.ok(box && box.y >= -1 && box.y < (width < 600 ? 844 : 1000), "Visible ticket title");
    if(actualScroll > 100) assert.ok(box.y <= (width <= 760 ? 65 : 5), "Sticky title after actual scrolling");
    checks.push({name:"ticket-title-scroll",width,actualScroll,headerY:box.y,passed:true});
    await page.evaluate(() => scrollTo(0, 0));
    await inspect(`ticket-work-${width}`, true);
  }
  await admin.close();
  for (const [index, participant] of session.roles.entries()) {
    if (!["worker", "tenant"].includes(participant.role)) continue;
    const context = await contextFor(participant.token);
    page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/#section=service`);
    await page.locator(".service-workspace").waitFor();
    await sweepTabs(`role-${index}-${participant.role}`, 390);
    await context.close();
  }
  assert.deepEqual(errors, [], "Application errors");
  assert.deepEqual(writes, [], "Read-only UI sweep");
  console.log(
    JSON.stringify({
      passed: true,
      checks: checks.length,
      errors: 0,
      mutations: 0,
    }),
  );
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
      .catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(
      { passed: !process.exitCode, checks, errors, writes },
      null,
      2,
    ),
  );
  await browser.close();
}
