import { useState } from "react";
import { SidePanel } from "../../ui/SidePanel";
import { Register } from "../business/Register";
import {
  Button,
  IconButton,
  Checkbox,
  Input,
  Select,
  Textarea,
} from "../../ui";
import { ActionIcon } from "../business/ActionIcon";
import { usePlatform } from "./usePlatform";
import type { CatalogItem } from "../../../../../packages/contracts/src/operations-platform";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
import type { Props } from "../operations/shared";
export function Catalog({
  kind,
  ...props
}: Props & { kind: "templates" | "materials" | "contractors" }) {
  const { data, error, busy, mutate } = usePlatform(props.token);
  const [draft, setDraft] = useState<CatalogItem | null>(null);
  const [dirty, setDirty] = useState(false);
  const labels = {
    templates: "Регламенты",
    materials: "Материалы",
    contractors: "Подрядчики",
  };
  const canWrite = hasPermission(
    props.user,
    kind === "templates" ? "maintenance.write" : "services.write",
  );
  const change = (key: string, value: unknown) => {
    setDirty(true);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = {
      propertyId: draft.propertyId,
      name: draft.name,
      ...(draft.id ? { updatedAt: draft.updatedAt } : {}),
      ...(kind === "templates"
        ? { instructions: draft.instructions, checklist: draft.checklist }
        : kind === "materials"
          ? { unit: draft.unit, price: draft.price, active: draft.active }
          : { inn: draft.inn, contact: draft.contact, active: draft.active }),
    };
    if (
      await mutate(
        `/api/maintenance/${kind}${draft.id ? "/" + draft.id : ""}`,
        body,
        draft.id ? "PUT" : "POST",
      )
    )
      setDraft(null);
  };
  return (
    <div className="platform-section">
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <Register
        title={labels[kind]}
        rows={data[kind]}
        searchText={(row) =>
          `${row.name} ${row.inn ?? ""} ${row.contact ?? ""}`
        }
        onSelect={
          canWrite
            ? (row) => {
                setDirty(false);
                setDraft({ ...row });
              }
            : undefined
        }
        action={
          canWrite ? (
            <IconButton
              label="Добавить"
              variant="primary"
              onClick={() => {
                setDirty(false);
                setDraft({
                  id: "",
                  propertyId: props.overview.properties[0]?.id ?? "",
                  name: "",
                  updatedAt: "",
                  instructions: "",
                  checklist: [""],
                  unit: "шт.",
                  price: 0,
                  inn: "",
                  contact: "",
                  active: true,
                });
              }}
            >
              <ActionIcon name="plus" />
            </IconButton>
          ) : undefined
        }
        columns={[
          {
            key: "name",
            label: "Название",
            render: (row) => <strong>{row.name}</strong>,
          },
          {
            key: "property",
            label: "Объект",
            render: (row) =>
              props.overview.properties.find((p) => p.id === row.propertyId)
                ?.name ?? "—",
          },
          {
            key: "details",
            label:
              kind === "templates"
                ? "Версия и чек-лист"
                : kind === "materials"
                  ? "Цена / единица"
                  : "ИНН",
            render: (row) =>
              kind === "templates"
                ? `Версия ${row.version} · ${row.checklist?.length ?? 0} пунктов`
                : kind === "materials"
                  ? `${row.price} ₽ / ${row.unit}`
                  : row.inn,
          },
          {
            key: "status",
            label: kind === "contractors" ? "Контакт" : "Состояние",
            render: (row) =>
              row.active === false
                ? "Отключён"
                : kind === "contractors"
                  ? row.contact || "—"
                  : "Доступен",
          },
        ]}
      />
      {draft && (
        <SidePanel
          title={`${draft.id ? "Редактирование" : "Новая запись"} · ${labels[kind]}`}
          onClose={() => setDraft(null)}
          busy={busy}
          dirty={dirty}
        >
          {error && (
            <p role="alert" className="notice notice--error">
              {error}
            </p>
          )}
          <form className="form-grid" onSubmit={save}>
            <label>
              Название
              <Input
                required
                value={draft.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label>
              Объект
              <Select
                disabled={!!draft.id}
                value={draft.propertyId}
                onChange={(e) => change("propertyId", e.target.value)}
              >
                {props.overview.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            {kind === "templates" ? (
              <>
                <label>
                  Инструкция
                  <Textarea
                    value={draft.instructions}
                    onChange={(e) => change("instructions", e.target.value)}
                  />
                </label>
                <label>
                  Чек-лист, по пункту на строку
                  <Textarea
                    required
                    value={draft.checklist?.join("\n")}
                    onChange={(e) =>
                      change("checklist", e.target.value.split("\n"))
                    }
                  />
                </label>
                <p className="field-hint">
                  Изменение регламента создаёт новую версию. Существующие
                  графики сохраняют утверждённый чек-лист; выберите регламент
                  повторно в графике, чтобы обновить его.
                </p>
              </>
            ) : kind === "materials" ? (
              <>
                <label>
                  Единица измерения
                  <Input
                    required
                    value={draft.unit}
                    onChange={(e) => change("unit", e.target.value)}
                  />
                </label>
                <label>
                  Цена без НДС, ₽
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => change("price", Number(e.target.value))}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  ИНН
                  <Input
                    required
                    pattern="[0-9]{10}|[0-9]{12}"
                    value={draft.inn}
                    onChange={(e) => change("inn", e.target.value)}
                  />
                </label>
                <label>
                  Контакт
                  <Input
                    value={draft.contact}
                    onChange={(e) => change("contact", e.target.value)}
                  />
                </label>
              </>
            )}
            {kind !== "templates" && (
              <Checkbox
                checked={draft.active}
                onChange={(e) => change("active", e.target.checked)}
              >
                Доступен в каталоге
              </Checkbox>
            )}
            <div className="mvp-actions">
              <Button type="submit" variant="primary" busy={busy}>
                Сохранить
              </Button>
              <Button disabled={busy} onClick={() => setDraft(null)}>
                Отмена
              </Button>
            </div>
          </form>
        </SidePanel>
      )}
    </div>
  );
}
