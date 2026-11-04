import { useRef } from "react";
import { Button, Checkbox, IconButton, Input, Select } from "../../../ui";
import { ActionIcon } from "../../business/ActionIcon";
import { isOpenTicket } from "../../../../../../packages/contracts/src/domain.js";
import { bounds, download, exportDxf } from "./geometry";
import { PlanCanvas } from "./PlanCanvas";
import { usePlanEditor, type PlanEditorProps } from "./usePlanEditor";
import "./plan-editor.css";
export function PlanEditor(props: PlanEditorProps) {
  const importInput = useRef<HTMLInputElement>(null);
  const {
    plans,
    draft,
    setDraft,
    error,
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
    unitOptions,
    shape,
    unitId,
    equipment,
    save,
    importFile,
    patchShape,
    imageHeight,
  } = usePlanEditor(props);
  return (
    <div className="platform-section plan-editor">
      <div className="mvp-actions plan-selection-toolbar">
        <Select
          aria-label="Выбор плана"
          value={draft?.id ?? ""}
          disabled={dirty}
          onChange={(e) => {
            const p = plans.find((p) => p.id === e.target.value);
            if (p) open(p);
          }}
        >
          <option value="">Выберите план</option>
          {plans
            .filter((p) => p.propertyId === props.propertyId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
        {props.canWrite && (
          <IconButton label="Новый план" disabled={dirty} onClick={create}>
            <ActionIcon name="plus" />
          </IconButton>
        )}
        {dirty && (
          <IconButton
            label="Отменить изменения"
            onClick={() => {
              setDraft(null);
              setDirty(false);
            }}
          >
            <ActionIcon name="close" />
          </IconButton>
        )}
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!draft ? (
        <p>
          Выберите генплан или план этажа. Можно загрузить DXF, добавить
          подложку и привязать помещения к контурам.
        </p>
      ) : (
        <>
          <div className="form-grid">
            <label>
              Название
              <Input
                disabled={!props.canWrite}
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <label>
              Уровень
              <Select
                disabled={!props.canWrite}
                value={draft.floorId ?? ""}
                onChange={(e) =>
                  update({
                    floorId: e.target.value || null,
                    kind: e.target.value ? "floor" : "site",
                  })
                }
              >
                <option value="">Генеральный план</option>
                {props.structure.floors
                  .filter((f) => f.propertyId === props.propertyId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {
                        props.structure.entrances.find(
                          (v) => v.id === f.entranceId,
                        )?.name
                      }{" "}
                      / {f.name}
                    </option>
                  ))}
              </Select>
            </label>
          </div>
          <div className="plan-toolbar" aria-label="Инструменты плана">
            <div className="plan-tool-group" role="group" aria-label="Масштаб">
              <IconButton
                label="Приблизить"
                onClick={() =>
                  setView({
                    ...view,
                    x: view.x + view.width * 0.1,
                    y: view.y + view.height * 0.1,
                    width: view.width * 0.8,
                    height: view.height * 0.8,
                  })
                }
              >
                <ActionIcon name="zoomIn" />
              </IconButton>
              <IconButton
                label="Отдалить"
                onClick={() =>
                  setView({
                    ...view,
                    x: view.x - view.width * 0.125,
                    y: view.y - view.height * 0.125,
                    width: view.width * 1.25,
                    height: view.height * 1.25,
                  })
                }
              >
                <ActionIcon name="zoomOut" />
              </IconButton>
              <IconButton
                label="Вписать"
                onClick={() =>
                  setView(bounds(draft.geometry, draft.image, imageHeight))
                }
              >
                <ActionIcon name="fit" />
              </IconButton>
            </div>
            <div
              className="plan-tool-group"
              role="group"
              aria-label="Режим работы"
            >
              <IconButton
                label="Перемещение"
                aria-pressed={tool === "pan"}
                onClick={() => setTool("pan")}
              >
                <ActionIcon name="pan" />
              </IconButton>
              {props.canWrite && (
                <>
                  <IconButton
                    label="Нарисовать контур"
                    aria-pressed={tool === "draw"}
                    onClick={() => {
                      setTool("draw");
                      setPoints([]);
                    }}
                  >
                    <ActionIcon name="polygon" />
                  </IconButton>
                  <IconButton
                    label="Править вершины"
                    aria-pressed={tool === "edit"}
                    onClick={() => setTool("edit")}
                  >
                    <ActionIcon name="vertices" />
                  </IconButton>
                </>
              )}
            </div>
            <div
              className="plan-tool-group"
              role="group"
              aria-label="Файлы плана"
            >
              {props.canWrite && (
                <>
                  <IconButton
                    label="Импорт DXF / изображения"
                    disabled={busy}
                    onClick={() => importInput.current?.click()}
                  >
                    <ActionIcon name="upload" />
                  </IconButton>
                  <Input
                    ref={importInput}
                    aria-label="Импорт DXF / изображения"
                    hidden
                    disabled={busy}
                    type="file"
                    accept=".dxf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importFile(file);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
              <IconButton
                label="Экспорт DXF"
                disabled={!draft.geometry.length}
                onClick={() =>
                  download(`${draft.name}.dxf`, exportDxf(draft.geometry))
                }
              >
                <ActionIcon name="download" />
              </IconButton>
            </div>
          </div>
          {tool === "draw" && (
            <div className="mvp-actions">
              <span>
                Нажмите на план, чтобы добавить вершины: {points.length}.
              </span>
              <Button
                disabled={points.length < 3}
                onClick={() => {
                  const s = {
                    id: crypto.randomUUID(),
                    type: "polygon" as const,
                    layer: "Помещения",
                    points,
                  };
                  update({ geometry: [...draft.geometry, s] });
                  select(s.id);
                  setPoints([]);
                  setTool("edit");
                }}
              >
                Замкнуть контур
              </Button>
              <Button
                disabled={!points.length}
                onClick={() => setPoints((p) => p.slice(0, -1))}
              >
                Убрать последнюю точку
              </Button>
            </div>
          )}
          <div className="plan-workspace">
            <PlanCanvas
              imageHeight={imageHeight}
              plan={draft}
              view={view}
              setView={setView}
              hidden={hidden}
              selected={selected}
              select={select}
              tool={tool}
              points={points}
              addPoint={(p) => setPoints((v) => [...v, p])}
              updateGeometry={(geometry) => update({ geometry })}
              ticketUnits={
                new Set(
                  props.tickets
                    .filter((t) => isOpenTicket(t.status))
                    .map((t) => t.unitId),
                )
              }
              unitLabels={new Map(props.units.map((u) => [u.id, u.number]))}
            />
            <aside className="plan-inspector">
              <h4>Слои</h4>
              {[...new Set(draft.geometry.map((s) => s.layer))].map((layer) => (
                <Checkbox
                  key={layer}
                  checked={!hidden.includes(layer)}
                  onChange={(e) =>
                    setHidden((h) =>
                      e.target.checked
                        ? h.filter((v) => v !== layer)
                        : [...h, layer],
                    )
                  }
                >
                  {layer}
                </Checkbox>
              ))}
              {shape && (
                <>
                  <h4>Выбранный элемент</h4>
                  <label>
                    Помещение
                    <Select
                      disabled={!props.canWrite}
                      value={shape.unitId ?? ""}
                      aria-label="Помещение на плане"
                      onChange={(e) =>
                        patchShape({
                          unitId: e.target.value || null,
                          equipmentId: null,
                        })
                      }
                    >
                      <option value="">Без привязки</option>
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.number} · {u.tenantName ?? "Без арендатора"}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    Оборудование
                    <Select
                      disabled={!props.canWrite}
                      value={shape.equipmentId ?? ""}
                      onChange={(e) => {
                        const eq = equipment.find(
                          (v) => v.id === e.target.value,
                        );
                        patchShape({
                          equipmentId: eq?.id ?? null,
                          ...(eq ? { unitId: eq.unitId } : {}),
                        });
                      }}
                    >
                      <option value="">Без привязки</option>
                      {equipment
                        .filter(
                          (e) => !shape.unitId || e.unitId === shape.unitId,
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </Select>
                  </label>
                  {props.canWrite && (
                    <Button
                      onClick={() => {
                        update({
                          geometry: draft.geometry.filter(
                            (s) => s.id !== selected,
                          ),
                        });
                        select("");
                      }}
                    >
                      Удалить элемент
                    </Button>
                  )}
                </>
              )}
              {unitId && (
                <>
                  <Button onClick={() => props.onUnit(unitId)}>
                    Карточка помещения
                  </Button>
                  <h4>Открытые заявки</h4>
                  {props.tickets
                    .filter(
                      (t) => t.unitId === unitId && isOpenTicket(t.status),
                    )
                    .map((t) => (
                      <Button
                        key={t.id}
                        variant="text"
                        onClick={() => props.onTicket?.(t.id)}
                      >
                        {t.number} · {t.title}
                      </Button>
                    ))}
                </>
              )}
            </aside>
          </div>
          {props.canWrite && (
            <div className="mvp-actions">
              <Button
                variant="primary"
                busy={busy}
                disabled={!dirty}
                onClick={save}
              >
                Сохранить план
              </Button>
              <span>
                {dirty
                  ? "Есть несохранённые изменения"
                  : `Версия ${draft.version}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
