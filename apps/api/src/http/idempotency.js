import crypto from "node:crypto";
import { RequestError, preloadedBody } from "./body.js";

const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

// Reads the optional Idempotency-Key header of a command. Keys are scoped to
// the caller's credentials, so one person can never replay another's response,
// and bound to the exact request so a reused key cannot run a different one.
export function idempotencyFor(request, method, url) {
  const key = request.headers["idempotency-key"];
  if (key === undefined || method === "GET" || method === "HEAD") return null;
  if (typeof key !== "string" || !keyPattern.test(key))
    throw new RequestError(
      "Некорректный заголовок Idempotency-Key",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  return {
    key,
    scope: sha256(String(request.headers.authorization ?? "anonymous")),
    requestHash: sha256(
      `${method} ${url.pathname}${url.search}\n${preloadedBody(request)}`,
    ),
  };
}
