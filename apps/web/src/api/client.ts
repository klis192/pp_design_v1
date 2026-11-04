import type { ApiErrorDto } from "../../../../packages/contracts/src/requests.ts";
import { ApiError, normalizeRequestError } from "./read-errors";
export { ApiError } from "./read-errors";
export const runtimeApiBase =
  import.meta.env.VITE_WAREHOUSE_API_BASE_URL ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://127.0.0.1:3001"
    : "");
export async function apiRequest<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  try {
    const response = await fetch(`${runtimeApiBase}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new ApiError(
        "Сервер вернул неожиданный ответ. Повторите запрос.",
        response.status,
        "INVALID_RESPONSE",
      );
    const payload = await response.json();
    if (!response.ok) {
      const error = payload as ApiErrorDto;
      const details = error.fields
        ?.map((field) => `${field.path || "Запрос"}: ${field.message}`)
        .join("; ");
      throw new ApiError(
        details || error.error || `Ошибка запроса (${response.status})`,
        response.status,
        error.code || "REQUEST_ERROR",
        error.fields,
      );
    }
    return payload as T;
  } catch (error) {
    throw normalizeRequestError(error, options.signal);
  }
}
