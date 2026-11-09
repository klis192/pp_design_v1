import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { fixture } from "../fixtures.mjs";
import { postgresFixture } from "./helpers.mjs";
import { createToken } from "../../apps/api/src/auth.js";

const secret = "wirehouse-test-secret";

test("A repeated command with the same Idempotency-Key is answered from the stored response and runs once", async (t) => {
  const f = fixture();
  t.after(f.cleanup);
  const ticket = f.db.createTicket({
    propertyId: f.property.id,
    unitId: f.unit.id,
    tenantId: f.tenant.id,
    leaseId: f.lease.id,
    assignedTo: f.worker.id,
    category: "electrical",
    priority: "medium",
    title: "Проверить щит",
    description: "Проверка",
  });
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const pg = await postgresFixture(f.db.data);
  const child = spawn(process.execPath, ["apps/api/src/index.js"], {
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(port),
      DATABASE_URL: pg.url,
      REDIS_URL: "",
      JWT_ACCESS_SECRET: secret,
      NOTIFICATION_CHANNELS: "in_app",
      TELEGRAM_BOT_TOKEN: "",
      VK_GROUP_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await pg.cleanup();
  });
  const base = `http://127.0.0.1:${port}`;
  for (let ready = false, deadline = Date.now() + 30_000; !ready;) {
    if (child.exitCode !== null || Date.now() > deadline) throw Error(output);
    ready = await fetch(`${base}/health`)
      .then((r) => r.ok)
      .catch(() => false);
    if (!ready) await new Promise((r) => setTimeout(r, 50));
  }
  const tokenFor = (user) =>
    createToken({ sub: user.id, role: user.role }, secret);
  const workerToken = tokenFor(f.worker);
  const comments = `/api/tickets/${ticket.id}/comments`;
  const post = async (body, key, token = workerToken) => {
    const r = await fetch(`${base}${comments}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    });
    return {
      status: r.status,
      replayed: r.headers.get("idempotent-replayed"),
      body: await r.json(),
    };
  };
  const count = async () =>
    (
      await fetch(`${base}${comments}`, {
        headers: { Authorization: `Bearer ${workerToken}` },
      }).then((r) => r.json())
    ).items.length;

  // Browsers must be allowed to send the header cross-origin.
  const preflight = await fetch(`${base}${comments}`, { method: "OPTIONS" });
  assert.match(
    preflight.headers.get("access-control-allow-headers"),
    /Idempotency-Key/,
  );

  const before = await count();
  const key = "test-key-0000000001";
  const first = await post({ content: "Фото загружено" }, key);
  assert.equal(first.status, 201);
  assert.equal(first.replayed, null);
  const again = await post({ content: "Фото загружено" }, key);
  assert.equal(again.status, 201);
  assert.equal(again.replayed, "true");
  assert.deepEqual(again.body, first.body);
  assert.equal(await count(), before + 1);

  // The same key cannot run a different command.
  const reused = await post({ content: "Другой текст" }, key);
  assert.equal(reused.status, 422);
  assert.equal(reused.body.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal(await count(), before + 1);

  // Keys are scoped to the caller: another account's identical key runs anew.
  const manager = await post(
    { content: "Фото загружено" },
    key,
    tokenFor(f.manager),
  );
  assert.equal(manager.status, 201);
  assert.equal(manager.replayed, null);
  assert.equal(await count(), before + 2);

  // A rejected command is not stored, so a corrected retry with the key runs.
  const failedKey = "test-key-0000000002";
  assert.equal((await post({}, failedKey)).status, 400);
  assert.equal((await post({ content: "Исправлено" }, failedKey)).status, 201);
  assert.equal(await count(), before + 3);

  // Without the header the old behaviour is unchanged.
  await post({ content: "Без ключа" });
  await post({ content: "Без ключа" });
  assert.equal(await count(), before + 5);

  assert.equal(
    (await post({ content: "x" }, "short")).body.code,
    "INVALID_IDEMPOTENCY_KEY",
  );
});
