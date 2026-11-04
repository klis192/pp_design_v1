import { useLiveQuery } from "../../realtime/RealtimeContext";
import { useState } from "react";
import { apiRequest } from "../../api/client";
import { Button, IconButton, Input, Select } from "../../ui";
import { ActionIcon } from "../business/ActionIcon";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { SidePanel } from "../../ui/SidePanel";
import type {
  Structure,
  Building,
  Entrance,
  Floor,
} from "../../../../../packages/contracts/src/operations-platform";
import type { Unit, Ticket, Row } from "../operations/shared";
import { PlanEditor } from "./plans/PlanEditor";
type Props = {
  token: string;
  properties: { id: string; name: string }[];
  units: Unit[];
  tickets: Ticket[];
  equipment: Row[];
  onUnit: (id: string) => void;
  onTicket?: (id: string) => void;
  canWrite?: boolean;
  embedded?: boolean;
  view?: "tree" | "plans";
};
type Node = Partial<Building & Entrance & Floor>;
const nodeLabel = (kind: string, name: string) =>
  !name
    ? `${kind} не указан`
    : name.toLocaleLowerCase("ru").startsWith(kind.toLocaleLowerCase("ru"))
      ? name
      : `${kind} ${name}`;
export function StructureWorkspace(props: Props) {
  const resource = useLiveQuery<Structure>(props.token, "/api/structure", {
    buildings: [],
    entrances: [],
    floors: [],
  });
  const [localMode, setMode] = useState("tree"),
    [failure, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<keyof Structure>("buildings"),
    [draft, setDraft] = useState<Node | null>(null);
  const [dirty, setDirty] = useState(false);
  const [property, setProperty] = useState(props.properties[0]?.id ?? "");
  const mode = props.view ?? localMode;
  const { data, load: reload } = resource;
  const error = failure || resource.error;
  const change = (key: string, value: string | number) => {
    setDirty(true);
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/api/structure/${kind}${draft.id ? "/" + draft.id : ""}`,
        {
          token: props.token,
          method: draft.id ? "PUT" : "POST",
          body: {
            propertyId: property,
            name: draft.name,
            ...(draft.id ? { updatedAt: draft.updatedAt } : {}),
            ...(kind === "entrances"
              ? { buildingId: draft.buildingId }
              : kind === "floors"
                ? { entranceId: draft.entranceId, number: draft.number }
                : {}),
          },
        },
      );
      await reload();
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const edit = (k: keyof Structure, row: Node) => {
    setDirty(false);
    setKind(k);
    setDraft({ ...row });
  };
  const remove = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      await apiRequest(`/api/structure/${kind}/${draft.id}`, {
        token: props.token,
        method: "DELETE",
      });
      await reload();
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={
        props.embedded ? "platform-section" : "mvp-card platform-section"
      }
    >
      {!props.view && (
        <div className="mvp-card-head">
          <h3>Структура и планы</h3>
          <WorkspaceTabs
            label="Структура и планы"
            items={[
              { id: "tree", label: "Структура" },
              { id: "plans", label: "Планы" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      )}
      {props.properties.length > 1 && (
        <label>
          Объект
          <Select
            value={property}
            onChange={(e) => {
              setProperty(e.target.value);
              setDraft(null);
            }}
          >
            {props.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      {error && (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      )}
      {mode === "plans" ? (
        <PlanEditor {...props} propertyId={property} structure={data} />
      ) : (
        <>
          {props.canWrite && (
            <div className="workspace-toolbar-row">
              <h3>Структура объекта</h3>
              <IconButton
                label="Добавить в структуру"
                onClick={() => {
                  setDirty(false);
                  setKind("buildings");
                  setDraft({
                    name: "",
                    propertyId: property,
                    number: 1,
                    buildingId: "",
                    entranceId: "",
                  });
                }}
              >
                <ActionIcon name="plus" />
              </IconButton>
            </div>
          )}
          {draft && (
            <SidePanel
              title={
                draft.id ? "Изменить элемент структуры" : "Добавить в структуру"
              }
              onClose={() => setDraft(null)}
              busy={busy}
              dirty={dirty}
            >
              {error && (
                <p className="notice notice--error" role="alert">
                  {error}
                </p>
              )}
              <form className="form-grid" onSubmit={save}>
                {!draft.id && (
                  <label>
                    Уровень
                    <Select
                      value={kind}
                      onChange={(e) => {
                        setDirty(true);
                        setKind(e.target.value as keyof Structure);
                        setDraft({
                          ...draft,
                          buildingId: "",
                          entranceId: "",
                          number: 1,
                        });
                      }}
                    >
                      <option value="buildings">Корпус</option>
                      <option value="entrances">Подъезд</option>
                      <option value="floors">Этаж</option>
                    </Select>
                  </label>
                )}
                <label>
                  Название
                  <Input
                    required
                    value={draft.name ?? ""}
                    onChange={(e) => change("name", e.target.value)}
                  />
                </label>
                {kind === "entrances" && (
                  <label>
                    Корпус
                    <Select
                      required
                      value={draft.buildingId ?? ""}
                      onChange={(e) => change("buildingId", e.target.value)}
                    >
                      <option value="">Выберите корпус</option>
                      {data.buildings
                        .filter((b) => b.propertyId === property)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </Select>
                  </label>
                )}
                {kind === "floors" && (
                  <>
                    <label>
                      Подъезд
                      <Select
                        required
                        value={draft.entranceId ?? ""}
                        onChange={(e) => change("entranceId", e.target.value)}
                      >
                        <option value="">Выберите подъезд</option>
                        {data.entrances
                          .filter((b) => b.propertyId === property)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {
                                data.buildings.find(
                                  (v) => v.id === b.buildingId,
                                )?.name
                              }{" "}
                              / {b.name}
                            </option>
                          ))}
                      </Select>
                    </label>
                    <label>
                      Номер этажа
                      <Input
                        type="number"
                        required
                        min="-10"
                        max="300"
                        value={draft.number}
                        onChange={(e) =>
                          change("number", Number(e.target.value))
                        }
                      />
                    </label>
                  </>
                )}
                <div className="mvp-actions">
                  <Button variant="primary" type="submit" busy={busy}>
                    Сохранить
                  </Button>
                  <Button disabled={busy} onClick={() => setDraft(null)}>
                    Отмена
                  </Button>
                  {draft.id && (
                    <Button disabled={busy} onClick={remove}>
                      Удалить пустой узел
                    </Button>
                  )}
                </div>
              </form>
            </SidePanel>
          )}
          <div className="structure-tree">
            {data.buildings
              .filter((b) => b.propertyId === property)
              .map((b) => (
                <section className="structure-building" key={b.id}>
                  <div className="structure-node-header">
                    <h4>{nodeLabel("Корпус", b.name)}</h4>
                    {props.canWrite && (
                      <IconButton
                        label="Изменить корпус"
                        onClick={() => edit("buildings", b)}
                      >
                        <ActionIcon name="edit" />
                      </IconButton>
                    )}
                  </div>
                  <div className="structure-entrances">
                    {data.entrances
                      .filter((e) => e.buildingId === b.id)
                      .map((e) => (
                        <section className="structure-entrance" key={e.id}>
                          <div className="structure-node-header">
                            <h5>{nodeLabel("Подъезд", e.name)}</h5>
                            {props.canWrite && (
                              <IconButton
                                label="Изменить подъезд"
                                onClick={() => edit("entrances", e)}
                              >
                                <ActionIcon name="edit" />
                              </IconButton>
                            )}
                          </div>
                          <div className="structure-floors">
                            {data.floors
                              .filter((f) => f.entranceId === e.id)
                              .sort((a, b) => a.number - b.number)
                              .map((f) => (
                                <section className="structure-floor" key={f.id}>
                                  <div className="structure-node-header">
                                    <h6>
                                      {nodeLabel(
                                        "Этаж",
                                        f.name || String(f.number),
                                      )}{" "}
                                      ·{" "}
                                      {
                                        props.units.filter(
                                          (u) => u.floorId === f.id,
                                        ).length
                                      }{" "}
                                      помещений
                                    </h6>
                                    {props.canWrite && (
                                      <IconButton
                                        label="Изменить этаж"
                                        onClick={() => edit("floors", f)}
                                      >
                                        <ActionIcon name="edit" />
                                      </IconButton>
                                    )}
                                  </div>
                                  <div className="structure-units">
                                    {props.units
                                      .filter((u) => u.floorId === f.id)
                                      .map((u) => (
                                        <Button
                                          key={u.id}
                                          onClick={() => props.onUnit(u.id)}
                                        >
                                          <strong>{u.number}</strong>
                                          <span>
                                            {u.area} м² ·{" "}
                                            {u.tenantName || "Без арендатора"}
                                          </span>
                                        </Button>
                                      ))}
                                  </div>
                                </section>
                              ))}
                          </div>
                        </section>
                      ))}
                  </div>
                </section>
              ))}
          </div>
          {!data.buildings.some((b) => b.propertyId === property) && (
            <p>Структура пока не заполнена. Добавьте корпус, подъезд и этаж.</p>
          )}
        </>
      )}
    </article>
  );
}
