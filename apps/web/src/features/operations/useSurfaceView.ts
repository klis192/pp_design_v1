import { useEffect, useState } from "react";

export function useSurfaceView<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
) {
  const read = () => {
    try {
      const value = sessionStorage.getItem(key);
      return value && allowed.includes(value as T) ? (value as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const [stored, setStored] = useState(() => ({ key, value: read() }));
  const value = stored.key === key ? stored.value : read();
  useEffect(() => {
    if (stored.key !== key) return;
    try {
      sessionStorage.setItem(key, stored.value);
    } catch {
      /* The view still works without browser storage. */
    }
  }, [key, stored]);
  return [
    value,
    (next: T) =>
      setStored({ key, value: allowed.includes(next) ? next : fallback }),
  ] as const;
}

export function useVisitedSurfaceViews<T extends string>(
  key: string,
  value: T,
) {
  const [stored, setStored] = useState(() => ({ key, views: [value] }));
  const views = stored.key === key ? stored.views : [];
  useEffect(() => {
    setStored((current) =>
      current.key === key && current.views.includes(value)
        ? current
        : {
            key,
            views: current.key === key ? [...current.views, value] : [value],
          },
    );
  }, [key, value]);
  return views.includes(value) ? views : [...views, value];
}
