import { useEffect, useState } from "react";

export function useWorkspaceViewState<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const read = (): T => {
    try {
      const value = sessionStorage.getItem(key);
      return value && allowed.includes(value as T) ? (value as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const [stored, setStored] = useState(() => ({ key, value: read() }));
  const candidate = stored.key === key ? stored.value : read();
  const value = allowed.includes(candidate) ? candidate : fallback;
  useEffect(() => {
    if (stored.key === key) {
      try {
        sessionStorage.setItem(key, stored.value);
      } catch {
        /* View state remains usable without storage. */
      }
    }
  }, [key, stored]);
  return [
    value,
    (next) => {
      if (allowed.includes(next)) setStored({ key, value: next });
    },
  ];
}
