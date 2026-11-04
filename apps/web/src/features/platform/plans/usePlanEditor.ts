import { useLiveQuery } from "../../../realtime/RealtimeContext";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest } from "../../../api/client";
import type {
  FloorPlan,
  PlanGeometry,
  Structure,
} from "../../../../../../packages/contracts/src/operations-platform";
import type { Unit, Ticket, Row } from "../../operations/shared";
import { bounds, type View } from "./geometry";
import {
  createDefaultPlanGeometry,
  DEFAULT_PLAN_LAYER,
  DEFAULT_PLAN_SOURCE,
} from "../../../../../../packages/contracts/src/floor-plans";
export type PlanEditorProps = {
  token: string;
  propertyId: string;
  structure: Structure;
  units: Unit[];
  tickets: Ticket[];
  equipment: Row[];
  onUnit: (id: string) => void;
  onTicket?: (id: string) => void;
  canWrite?: boolean;
  buildingId?: string | null;
  initialPlanId?: string;
};
type DraftSnapshot = {
  draft: FloorPlan;
  dirty: boolean;
  view: View;
  hidden: string[];
  selected: string;
  tool: string;
  points: { x: number; y: number }[];
  imageHeight: number;
  editStamp: number;
};
// Unsaved work survives SPA context changes in this tab, never persistent storage.
const planDrafts = new Map<string, DraftSnapshot>();
let nextEditStamp = 0;
export function usePlanEditor(props: PlanEditorProps) {
  const scopeKey = JSON.stringify([props.token, props.propertyId]);
  const initialCache = useRef(planDrafts.get(scopeKey));
  const activeScope = useRef(scopeKey);
  const scopeEpoch = useRef(0);
  const editStamp = useRef(initialCache.current?.editStamp ?? 0);
  const [loadedScope, setLoadedScope] = useState(scopeKey);
  const fitImageOnLoad = useRef(!initialCache.current);
  const [imageHeight, setImageHeight] = useState(
    initialCache.current?.imageHeight ?? 700,
  );
  const resource = useLiveQuery<{ floorplans: FloorPlan[] }>(
    props.token,
    "/api/operations",
    { floorplans: [] },
  );
  const plans = useMemo(
    () =>
      resource.data.floorplans.filter(
        (plan) =>
          plan.propertyId === props.propertyId &&
          (props.buildingId === undefined ||
            (plan.buildingId ?? null) === props.buildingId),
      ),
    [resource.data.floorplans, props.propertyId, props.buildingId],
  );
  const appliedRequest = useRef("");
  const [draft, setDraft] = useState<FloorPlan | null>(() =>
    initialCache.current ? structuredClone(initialCache.current.draft) : null,
  );
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(initialCache.current?.dirty ?? false);
  const [view, setView] = useState<View>(
      initialCache.current?.view ?? {
        x: 0,
        y: 0,
        width: 1000,
        height: 700,
      },
    ),
    [hidden, setHidden] = useState<string[]>(
      initialCache.current?.hidden ?? [],
    ),
    [selected, select] = useState(initialCache.current?.selected ?? ""),
    [tool, setTool] = useState(initialCache.current?.tool ?? "select");
  const [points, setPoints] = useState<{ x: number; y: number }[]>(
    initialCache.current?.points ?? [],
  );
  const live = useRef({
    key: scopeKey,
    draft,
    dirty,
    view,
    hidden,
    selected,
    tool,
    points,
    imageHeight,
    editStamp: editStamp.current,
  });
  live.current = {
    key: activeScope.current,
    draft,
    dirty,
    view,
    hidden,
    selected,
    tool,
    points,
    imageHeight,
    editStamp: editStamp.current,
  };
  useLayoutEffect(() => {
    scopeEpoch.current++;
    activeScope.current = scopeKey;
    if (loadedScope !== scopeKey) {
      const cached = planDrafts.get(scopeKey);
      setDraft(cached ? structuredClone(cached.draft) : null);
      setDirty(cached?.dirty ?? false);
      setView(cached?.view ?? { x: 0, y: 0, width: 1000, height: 700 });
      setHidden(cached?.hidden ?? []);
      select(cached?.selected ?? "");
      setTool(cached?.tool ?? "select");
      setPoints(cached?.points ?? []);
      setImageHeight(cached?.imageHeight ?? 700);
      setNotice("");
      setError("");
      setBusy(false);
      setLoadedScope(scopeKey);
      fitImageOnLoad.current = !cached;
      editStamp.current = cached?.editStamp ?? 0;
      live.current = {
        key: scopeKey,
        draft: cached?.draft ?? null,
        dirty: cached?.dirty ?? false,
        view: cached?.view ?? { x: 0, y: 0, width: 1000, height: 700 },
        hidden: cached?.hidden ?? [],
        selected: cached?.selected ?? "",
        tool: cached?.tool ?? "select",
        points: cached?.points ?? [],
        imageHeight: cached?.imageHeight ?? 700,
        editStamp: editStamp.current,
      };
    }
    appliedRequest.current = "";
    return () => {
      scopeEpoch.current++;
      const current = live.current;
      if (current.key !== scopeKey) return;
      if ((current.dirty || current.points.length > 0) && current.draft)
        planDrafts.set(
          scopeKey,
          structuredClone({
            draft: current.draft,
            dirty: current.dirty,
            view: current.view,
            hidden: current.hidden,
            selected: current.selected,
            tool: current.tool,
            points: current.points,
            imageHeight: current.imageHeight,
            editStamp: current.editStamp,
          }),
        );
      else planDrafts.delete(scopeKey);
    };
  }, [scopeKey]);
  const clearCachedDraft = (key: string) => {
    planDrafts.delete(key);
    if (live.current.key === key) live.current.dirty = false;
  };
  useEffect(() => {
    if (loadedScope !== scopeKey) return;
    if (!draft?.image) {
      setImageHeight(700);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active && image.naturalWidth) {
        const height = (1000 * image.naturalHeight) / image.naturalWidth;
        setImageHeight(height);
        if (fitImageOnLoad.current)
          setView(bounds(draft.geometry, draft.image, height));
      }
    };
    image.onerror = () => {
      if (active) setError("Не удалось загрузить подложку плана");
    };
    image.src = draft.image;
    return () => {
      active = false;
    };
  }, [draft?.image, loadedScope, scopeKey]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const prefix = `[${JSON.stringify(props.token)},`;
      if (
        dirty ||
        points.length > 0 ||
        [...planDrafts.keys()].some((key) => key.startsWith(prefix))
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, points.length, props.token]);
  useEffect(() => {
    if (loadedScope !== scopeKey || dirty || !draft?.id) return;
    const fresh = plans.find((p) => p.id === draft.id);
    if (fresh && fresh.version !== draft.version)
      setDraft(structuredClone(fresh));
  }, [plans, dirty, draft?.id, draft?.version, loadedScope, scopeKey]);
  const update = (patch: Partial<FloorPlan>) => {
    if (busy) return;
    editStamp.current = ++nextEditStamp;
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
    setNotice("");
  };
  const open = useCallback((p: FloorPlan) => {
    editStamp.current = 0;
    fitImageOnLoad.current = true;
    setDraft(structuredClone(p));
    setView(bounds(p.geometry, p.image));
    setHidden([]);
    select("");
    setPoints([]);
    setDirty(false);
    setNotice("");
    setTool("select");
    setError("");
  }, []);
  useEffect(() => {
    if (loadedScope !== scopeKey) return;
    const key = `${props.propertyId}:${props.buildingId ?? "all"}:${props.initialPlanId ?? ""}`;
    if (props.initialPlanId && appliedRequest.current !== key) {
      if (draft?.id === props.initialPlanId) {
        appliedRequest.current = key;
        return;
      }
      if (dirty || points.length > 0) {
        setNotice(
          "Сохраните или отмените изменения, чтобы открыть выбранный план.",
        );
        return;
      }
      if (resource.loading) return;
      appliedRequest.current = key;
      const requested = plans.find((plan) => plan.id === props.initialPlanId);
      if (requested) open(requested);
      else {
        setDraft(null);
        setNotice("План недоступен. Выберите другой план.");
      }
      return;
    }
    if (draft || dirty || resource.loading) return;
    const first = props.initialPlanId
      ? plans.find((plan) => plan.id === props.initialPlanId)
      : [...plans].sort((a, b) => {
          const rank = { site: 0, building: 1, floor: 2 };
          const usable = (plan: FloorPlan) =>
            Boolean(plan.geometry.length || plan.image || plan.markers.length);
          return (
            rank[a.kind] - rank[b.kind] ||
            Number(usable(b)) - Number(usable(a)) ||
            Number(Boolean(a.isDefault)) - Number(Boolean(b.isDefault)) ||
            b.updatedAt.localeCompare(a.updatedAt) ||
            a.id.localeCompare(b.id)
          );
        })[0];
    if (first) open(first);
  }, [
    plans,
    props.propertyId,
    props.buildingId,
    props.initialPlanId,
    resource.loading,
    draft,
    dirty,
    points.length,
    open,
    loadedScope,
    scopeKey,
  ]);
  const create = () => {
    open({
      id: "",
      propertyId: props.propertyId,
      buildingId: props.buildingId ?? null,
      name: "Новый план",
      kind: props.buildingId ? "building" : "site",
      floorId: null,
      image: "",
      geometry: createDefaultPlanGeometry(),
      layers: [DEFAULT_PLAN_LAYER],
      markers: [],
      sourceName: DEFAULT_PLAN_SOURCE,
      version: 0,
      updatedAt: "",
    });
    editStamp.current = ++nextEditStamp;
    setDirty(true);
  };
  const discard = () => {
    clearCachedDraft(scopeKey);
    const saved =
      plans.find((plan) => plan.id === draft?.id) ??
      plans.find((plan) => plan.id === props.initialPlanId) ??
      plans[0];
    if (saved) open(saved);
    else {
      setDraft(null);
      setDirty(false);
      setPoints([]);
      select("");
      setNotice("");
    }
  };
  const unitOptions = props.units.filter((unit) => {
    if (unit.propertyId !== props.propertyId) return false;
    if (draft?.floorId) return unit.floorId === draft.floorId;
    if (!draft?.buildingId) return true;
    const floor = props.structure.floors.find(
      (item) => item.id === unit.floorId,
    );
    const entrance = props.structure.entrances.find(
      (item) => item.id === floor?.entranceId,
    );
    return entrance?.buildingId === draft.buildingId;
  });
  const shape = draft?.geometry.find((s) => s.id === selected);
  const unitId =
    shape?.unitId ?? (selected.startsWith("marker:") ? selected.slice(7) : "");
  const equipment = props.equipment.filter((e) =>
    unitOptions.some((u) => u.id === e.unitId),
  );
  const save = async () => {
    if (!draft || busy || points.length > 0) return;
    if (!draft.name.trim()) {
      setError("Укажите название плана");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const savingScope = scopeKey;
    const savingEpoch = scopeEpoch.current;
    const savingEdit = editStamp.current;
    const current = () =>
      activeScope.current === savingScope && scopeEpoch.current === savingEpoch;
    try {
      const { id, updatedAt, ...fields } = draft;
      const body = {
        propertyId: fields.propertyId,
        buildingId: fields.buildingId ?? null,
        name: fields.name,
        kind: fields.kind,
        floorId: fields.floorId,
        image: fields.image,
        geometry: fields.geometry,
        layers: fields.layers,
        markers: fields.markers,
        sourceName: fields.sourceName,
        version: fields.version,
        ...(id ? { updatedAt } : {}),
      };
      const result = await apiRequest<{ item: FloorPlan }>(
        `/api/operations/floorplans${id ? "/" + id : ""}`,
        { token: props.token, method: id ? "PUT" : "POST", body },
      );
      await resource.load();
      if (planDrafts.get(savingScope)?.editStamp === savingEdit)
        planDrafts.delete(savingScope);
      if (current() && editStamp.current === savingEdit) {
        clearCachedDraft(savingScope);
        open(result.item);
        setNotice("План сохранён");
      }
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setBusy(false);
    }
  };
  const importFile = async (file: File) => {
    if (busy) return;
    const importingScope = scopeKey,
      importingEpoch = scopeEpoch.current;
    const current = () =>
      activeScope.current === importingScope &&
      scopeEpoch.current === importingEpoch;
    setError("");
    setNotice("");
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл должен быть не больше 8 МБ");
      return;
    }
    setBusy(true);
    try {
      if (/\.dxf$/i.test(file.name)) {
        const result = await apiRequest<{
          geometry: PlanGeometry;
          layers: string[];
          warnings: string[];
        }>("/api/operations/floorplans/import-dxf", {
          token: props.token,
          method: "POST",
          body: { content: await file.text() },
        });
        if (!current()) return;
        update({
          geometry: result.geometry,
          layers: result.layers,
          sourceName: file.name,
          image: "",
          markers: [],
        });
        setView(bounds(result.geometry, ""));
        setNotice(
          `Импортировано ${result.geometry.length} элементов. ${result.warnings.length ? result.warnings.join("; ") : "Все элементы обработаны."} Проверьте план и сохраните.`,
        );
      } else if (
        ["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        if (file.size > 2 * 1024 * 1024)
          throw new Error("Подложка должна быть не больше 2 МБ");
        const image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (!current()) return;
        update({ image, sourceName: file.name });
        fitImageOnLoad.current = true;
        setView(bounds(draft?.geometry ?? [], image));
      } else throw new Error("Поддерживаются текстовый DXF, PNG, JPEG и WebP");
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setBusy(false);
    }
  };
  const patchShape = (patch: Partial<PlanGeometry[number]>) =>
    update({
      geometry: draft!.geometry.map((s) =>
        s.id === selected ? { ...s, ...patch } : s,
      ),
    });
  return {
    plans,
    draft,
    setDraft,
    error: error || resource.error,
    notice,
    busy,
    dirty,
    setDirty,
    view,
    setView,
    hidden,
    setHidden,
    selected,
    select,
    tool,
    setTool,
    points,
    setPoints,
    update,
    open,
    create,
    discard,
    unitOptions,
    shape,
    unitId,
    equipment,
    save,
    importFile,
    patchShape,
    imageHeight,
    loading: resource.loading,
  };
}
