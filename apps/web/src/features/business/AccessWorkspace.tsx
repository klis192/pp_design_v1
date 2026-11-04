import { useState, type FormEvent } from "react";
import type { Assignment } from "../../../../../packages/contracts/src/access";
import { businessRolePermissions } from "../../../../../packages/contracts/src/access";
import {
  permissionLabels,
  type Permission,
} from "../../../../../packages/contracts/src/permissions";
import { useWorkspace } from "../../app/WorkspaceContext";
import { apiRequest } from "../../api/client";
import {
  Button,
  IconButton,
  Checkbox,
  Input,
  Select,
  Textarea,
} from "../../ui";
import { ActionIcon } from "./ActionIcon";
import { Feedback, Register, date, useResource } from "./shared";
import { SidePanel } from "../../ui/SidePanel";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { useWorkspaceViewState } from "../../ui/useWorkspaceViewState";
import type { AccountingWorkspace } from "../../../../../packages/contracts/src/accounting";
type Participant = {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
};
const roles = {
  owner: "Собственник",
  tenant: "Арендатор",
  manager: "Менеджер",
  worker: "Исполнитель",
};
const scopeNames = {
  property: "Объект",
  unit: "Помещение",
  lease: "Договор",
  account: "Лицевой счет",
};
function scopePermissions(
  role: keyof typeof roles,
  scope: keyof typeof scopeNames,
): Permission[] {
  return businessRolePermissions[role].filter(
    (permission) =>
      !(
        role === "owner" &&
        ["property", "unit"].includes(scope) &&
        ["finance.read", "work.approve"].includes(permission)
      ),
  );
}
export function AccessWorkspace() {
  const { session, overview, operations } = useWorkspace(),
    { token } = session;
  const resource = useResource<{ items: Assignment[] }>(
      token,
      "/api/access/assignments",
      { items: [] },
    ),
    people = useResource<{ items: Participant[] }>(
      token,
      "/api/access/participants",
      { items: [] },
    ),
    accounts = useResource<AccountingWorkspace>(token, "/api/accounting", {
      sources: [],
      accounts: [],
      statements: [],
      links: [],
    });
  const [edit, setEdit] = useState<Assignment | null>(null),
    [showForm, setShowForm] = useState(false),
    [role, setRole] = useState<keyof typeof roles>("tenant"),
    [scope, setScope] = useState<keyof typeof scopeNames>("lease"),
    [permissions, setPermissions] = useState<Permission[]>([
      ...businessRolePermissions.tenant,
    ]),
    [revoke, setRevoke] = useState("");
  const [view, setView] = useWorkspaceViewState(
    `wirehouse.access.view:${session.user.id}`,
    "assignments",
    ["assignments", "participants"] as const,
  );
  const [addingParticipant, setAddingParticipant] = useState(false),
    [formDirty, setFormDirty] = useState(false),
    [participantDirty, setParticipantDirty] = useState(false);
  const users = [
    ...people.data.items,
    ...(operations?.users ?? []).map((u) => ({
      id: u.id,
      full_name: String(u.fullName),
      role: String(u.role),
      email: null,
    })),
  ];
  const scopeRows =
    scope === "property"
      ? overview.properties.map((p) => ({ id: p.id, label: p.name }))
      : scope === "unit"
        ? overview.units.map((u) => ({
            id: u.id,
            label: `${u.propertyName} · ${u.number}`,
          }))
        : scope === "lease"
          ? overview.leases.map((l) => ({
              id: l.id,
              label: `${l.contractNumber} · ${l.unitNumber}`,
            }))
          : accounts.data.accounts.map((a) => ({ id: a.id, label: a.number }));
  const scopeLabel = (a: Assignment) =>
    a.scopeType === "property"
      ? overview.properties.find((p) => p.id === a.scopeId)?.name
      : a.scopeType === "unit"
        ? overview.units.find((u) => u.id === a.scopeId)?.number
        : a.scopeType === "lease"
          ? overview.leases.find((l) => l.id === a.scopeId)?.contractNumber
          : accounts.data.accounts.find((c) => c.id === a.scopeId)?.number;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      v = new FormData(form);
    void resource.run(async () => {
      await apiRequest(`/api/access/assignments${edit ? `/${edit.id}` : ""}`, {
        token,
        method: edit ? "PUT" : "POST",
        body: {
          userId: v.get("userId"),
          businessRole: role,
          scopeType: scope,
          scopeId: v.get("scopeId"),
          permissions,
          validFrom: v.get("validFrom"),
          validTo: v.get("validTo") || null,
          retainHistory: v.get("retainHistory") === "on",
          reason: v.get("reason"),
          ...(edit ? { updatedAt: edit.updatedAt } : {}),
        },
      });
      setShowForm(false);
      setFormDirty(false);
      setEdit(null);
    });
  };
  const openEdit = (a: Assignment) => {
    setFormDirty(false);
    setEdit(a);
    setRole(a.businessRole);
    setScope(a.scopeType);
    setPermissions(a.permissions);
    setShowForm(true);
  };
  return (
    <div className="business-stack">
      <Feedback {...resource} />
      <Feedback error={people.error || accounts.error} />
      <WorkspaceTabs
        label="Доступ и участники"
        idPrefix="access-views"
        value={view}
        onChange={(next) =>
          setView(next === "participants" ? "participants" : "assignments")
        }
        items={[
          {
            id: "assignments",
            label: "Назначения",
            count: resource.data.items.length,
          },
          {
            id: "participants",
            label: "Участники",
            count: people.data.items.length,
          },
        ]}
      />
      <div
        hidden={view !== "assignments"}
        role="tabpanel"
        id="access-views-panel-assignments"
        aria-labelledby="access-views-tab-assignments"
      >
        <Register
          title="Контекстные права"
          rows={resource.data.items}
          searchText={(a) =>
            `${users.find((u) => u.id === a.userId)?.full_name} ${roles[a.businessRole]} ${scopeLabel(a)} ${a.reason}`
          }
          action={
            <IconButton
              label="Назначить доступ"
              variant="primary"
              onClick={() => {
                setEdit(null);
                setFormDirty(false);
                setRole("tenant");
                setScope("lease");
                setPermissions([...businessRolePermissions.tenant]);
                setShowForm(!showForm);
              }}
            >
              <ActionIcon name="plus" />
            </IconButton>
          }
          columns={[
            {
              key: "user",
              label: "Пользователь",
              render: (a) =>
                users.find((u) => u.id === a.userId)?.full_name ??
                "Учетная запись",
            },
            {
              key: "role",
              label: "Бизнес-роль",
              render: (a) => roles[a.businessRole],
            },
            {
              key: "scope",
              label: "Область",
              render: (a) => (
                <>
                  {scopeNames[a.scopeType]} · {scopeLabel(a) ?? a.scopeId}
                </>
              ),
            },
            {
              key: "period",
              label: "Срок",
              render: (a) => (
                <>
                  {date(a.validFrom)} —{" "}
                  {a.validTo ? date(a.validTo) : "бессрочно"}
                  <small>
                    {a.revokedAt
                      ? "Доступ отозван"
                      : a.validFrom > new Date().toISOString().slice(0, 10)
                        ? "Еще не начался"
                        : a.validTo &&
                            a.validTo < new Date().toISOString().slice(0, 10)
                          ? a.retainHistory
                            ? "Только история"
                            : "Завершен"
                          : "Действует"}
                  </small>
                </>
              ),
            },
            {
              key: "actions",
              label: "Действия",
              render: (a) =>
                !a.revokedAt ? (
                  <div className="mvp-actions">
                    <IconButton label="Изменить" onClick={() => openEdit(a)}>
                      <ActionIcon name="edit" />
                    </IconButton>
                    <IconButton
                      label="Отозвать доступ"
                      onClick={() => setRevoke(a.id)}
                    >
                      <ActionIcon name="close" />
                    </IconButton>
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </div>
      <div
        hidden={view !== "participants"}
        role="tabpanel"
        id="access-views-panel-participants"
        aria-labelledby="access-views-tab-participants"
      >
        <Register
          title="Участники"
          rows={people.data.items}
          searchText={(person) => `${person.full_name} ${person.email ?? ""}`}
          action={
            <IconButton
              label="Добавить участника"
              variant="primary"
              onClick={() => {
                setParticipantDirty(false);
                setAddingParticipant(true);
              }}
            >
              <ActionIcon name="plus" />
            </IconButton>
          }
          columns={[
            {
              key: "name",
              label: "Имя",
              render: (person) => <strong>{person.full_name}</strong>,
            },
            {
              key: "email",
              label: "Почта",
              render: (person) => person.email ?? "—",
            },
            {
              key: "role",
              label: "Тип учётной записи",
              render: (person) =>
                person.role === "tenant"
                  ? "Клиент"
                  : person.role === "worker"
                    ? "Исполнитель"
                    : person.role === "admin"
                      ? "Администратор"
                      : "Сотрудник",
            },
          ]}
        />
      </div>
      {revoke && (
        <SidePanel
          title="Отозвать доступ"
          onClose={() => setRevoke("")}
          busy={resource.busy}
        >
          <Feedback {...resource} />
          <form
            className="form-grid business-detail"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget);
              void resource.run(async () => {
                await apiRequest(`/api/access/assignments/${revoke}/revoke`, {
                  token,
                  method: "POST",
                  body: { reason: v.get("reason") },
                });
                setRevoke("");
              }, "Доступ отозван");
            }}
          >
            <label>
              Причина отзыва
              <Input name="reason" required maxLength={10000} />
            </label>
            <div className="mvp-actions">
              <Button variant="danger" type="submit" busy={resource.busy}>
                Отозвать доступ
              </Button>
              <Button onClick={() => setRevoke("")}>Отмена</Button>
            </div>
          </form>
        </SidePanel>
      )}
      {showForm && (
        <SidePanel
          title={edit ? "Изменить назначение" : "Назначить доступ"}
          onClose={() => {
            setShowForm(false);
            setFormDirty(false);
          }}
          busy={resource.busy}
          dirty={formDirty}
        >
          <Feedback {...resource} />
          <form
            className="form-grid"
            key={edit?.id ?? "new"}
            onSubmit={submit}
            onChange={() => setFormDirty(true)}
          >
            {edit && (
              <>
                <Input type="hidden" name="userId" value={edit.userId} />
                <Input type="hidden" name="scopeId" value={edit.scopeId} />
              </>
            )}
            <label>
              Пользователь
              <Select
                key={["owner", "tenant"].includes(role) ? "tenant" : role}
                name="userId"
                required
                defaultValue={edit?.userId ?? ""}
                disabled={Boolean(edit)}
              >
                <option value="">Выберите</option>
                {users
                  .filter(
                    (u) =>
                      u.role ===
                      (["owner", "tenant"].includes(role) ? "tenant" : role),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Бизнес-роль
              <Select
                value={role}
                onChange={(e) => {
                  const r = e.target.value as keyof typeof roles;
                  const nextScope = r === "tenant" && !edit ? "lease" : scope;
                  setRole(r);
                  setPermissions(scopePermissions(r, nextScope));
                  setScope(nextScope);
                }}
              >
                {Object.entries(roles)
                  .filter(
                    ([key]) =>
                      !edit ||
                      ((["owner", "tenant"].includes(key) ? "tenant" : key) ===
                        users.find((u) => u.id === edit.userId)?.role &&
                        (key !== "tenant" ||
                          ["lease", "account"].includes(edit.scopeType))),
                  )
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Тип области
              <Select
                disabled={Boolean(edit)}
                value={scope}
                onChange={(e) => {
                  const next = e.target.value as keyof typeof scopeNames;
                  setScope(next);
                  setPermissions(
                    permissions.filter((p) =>
                      scopePermissions(role, next).includes(p),
                    ),
                  );
                }}
              >
                {Object.entries(scopeNames)
                  .filter(
                    ([k]) =>
                      role !== "tenant" || ["lease", "account"].includes(k),
                  )
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Область
              <Select
                key={scope}
                name="scopeId"
                disabled={Boolean(edit)}
                required
                defaultValue={edit?.scopeId ?? ""}
              >
                <option value="">Выберите</option>
                {scopeRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Доступ с
              <Input
                type="date"
                name="validFrom"
                required
                defaultValue={
                  edit?.validFrom ?? new Date().toISOString().slice(0, 10)
                }
              />
            </label>
            <label>
              Доступ до
              <Input
                type="date"
                name="validTo"
                defaultValue={edit?.validTo ?? ""}
              />
            </label>
            <fieldset className="permission-grid">
              <legend>Разрешения</legend>
              {scopePermissions(role, scope).map((p) => (
                <Checkbox
                  key={p}
                  checked={permissions.includes(p)}
                  onChange={(e) =>
                    setPermissions(
                      e.target.checked
                        ? [...permissions, p]
                        : permissions.filter((v) => v !== p),
                    )
                  }
                >
                  {permissionLabels[p]}
                </Checkbox>
              ))}
            </fieldset>
            {role === "owner" && ["property", "unit"].includes(scope) && (
              <p className="field-hint">
                Для финансов и согласования работ создайте отдельное назначение
                на договор или лицевой счет.
              </p>
            )}
            <Checkbox
              name="retainHistory"
              defaultChecked={edit?.retainHistory ?? true}
            >
              Сохранить просмотр истории после окончания срока
            </Checkbox>
            <label>
              Основание
              <Textarea
                name="reason"
                required
                defaultValue={edit?.reason ?? ""}
                maxLength={10000}
              />
            </label>
            <div className="mvp-actions">
              <Button variant="primary" type="submit" busy={resource.busy}>
                Сохранить доступ
              </Button>
              <Button onClick={() => setShowForm(false)}>Отмена</Button>
            </div>
          </form>
        </SidePanel>
      )}
      {addingParticipant && (
        <SidePanel
          title="Добавить участника"
          onClose={() => {
            setAddingParticipant(false);
            setParticipantDirty(false);
          }}
          busy={resource.busy}
          dirty={participantDirty}
        >
          <Feedback {...resource} />
          <form
            className="form-grid"
            onChange={() => setParticipantDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                v = new FormData(form);
              void resource.run(async () => {
                await apiRequest("/api/access/participants", {
                  token,
                  method: "POST",
                  body: {
                    fullName: v.get("fullName"),
                    email: v.get("email"),
                    phone: v.get("phone"),
                    password: v.get("password"),
                  },
                });
                await people.load();
                form.reset();
                setParticipantDirty(false);
                setAddingParticipant(false);
              }, "Участник добавлен. Назначьте ему доступ к нужному контексту.");
            }}
          >
            <label>
              ФИО
              <Input name="fullName" required maxLength={300} />
            </label>
            <label>
              Почта
              <Input name="email" type="email" required />
            </label>
            <label>
              Телефон
              <Input name="phone" type="tel" required />
            </label>
            <label>
              Начальный пароль
              <Input
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </label>
            <Button variant="primary" type="submit" busy={resource.busy}>
              Добавить участника
            </Button>
          </form>
        </SidePanel>
      )}
    </div>
  );
}
