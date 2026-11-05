import { useEffect, useState, type CSSProperties } from "react";
import {
  isCriticalTicket,
  isOpenTicket,
  slaState,
} from "../../../../../packages/contracts/src/domain";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
import { filterTickets } from "../../../../../packages/contracts/src/ticket-search";
import { useWorkspace } from "../../app/WorkspaceContext";
import { ticketStatusOptions } from "../../projectData";
import {
  daysUntil,
  formatArea,
  getSlaState,
  getTicketStatusLabel,
} from "../../shared/format";
import { Button, IconButton, Select } from "../../ui";
import "./manager-dashboard.css";
import { ActionIcon } from "../business/ActionIcon";
import { ActiveFilters, FilterBar, FilterSearch } from "../business/FilterBar";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import "../administration/management-mobile.css";

type DashboardFilters = {
  query: string;
  propertyId: string;
  status: string;
  deadline: "all" | "overdue";
  unassigned: boolean;
};

const openStatuses = ticketStatusOptions.filter(isOpenTicket);
const defaultFilters: DashboardFilters = {
  query: "",
  propertyId: "",
  status: "all",
  deadline: "all",
  unassigned: false,
};

function readFilters(key: string): DashboardFilters {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return { ...defaultFilters };
    return {
      query: typeof value.query === "string" ? value.query.slice(0, 300) : "",
      propertyId: typeof value.propertyId === "string" ? value.propertyId : "",
      status: openStatuses.includes(value.status) ? value.status : "all",
      deadline: value.deadline === "overdue" ? "overdue" : "all",
      // Прежняя версия хранила «Не назначены» как статус.
      unassigned: value.unassigned === true || value.status === "unassigned",
    };
  } catch {
    return { ...defaultFilters };
  }
}

export function ManagerDashboard() {
  const {
    managerUi,
    session,
    overview,
    locale,
    serviceTickets,
    setManagerScreen,
    openTicketDetail,
  } = useWorkspace();
  const storageKey = `wirehouse.dashboard.filters.v1:${session.user.id}`;
  const [storedFilters, setStoredFilters] = useState(() => ({
    key: storageKey,
    filters: readFilters(storageKey),
  }));
  const filters =
    storedFilters.key === storageKey
      ? storedFilters.filters
      : readFilters(storageKey);
  useEffect(() => {
    if (storedFilters.key !== storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(storedFilters.filters));
    } catch {
      // Filtering continues when browser storage is unavailable.
    }
  }, [storageKey, storedFilters]);
  const changeFilters = (patch: Partial<DashboardFilters>) =>
    setStoredFilters({ key: storageKey, filters: { ...filters, ...patch } });
  const resetFilters = () =>
    setStoredFilters({ key: storageKey, filters: { ...defaultFilters } });
  const hasFilters =
    Boolean(filters.query || filters.propertyId) ||
    filters.status !== "all" ||
    filters.deadline !== "all" ||
    filters.unassigned;
  const propertyAvailable =
    !filters.propertyId ||
    overview.properties.some((property) => property.id === filters.propertyId);
  const openTickets = serviceTickets
    .filter((ticket) => isOpenTicket(ticket.status))
    .sort(
      (a, b) =>
        Number(isCriticalTicket(b)) - Number(isCriticalTicket(a)) ||
        a.slaDueAt?.localeCompare(b.slaDueAt ?? "") ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  // Область просмотра — поиск и объект. Статус выбирается один,
  // «Просрочено» и «Без исполнителя» — независимые переключатели (И).
  const scopedTickets = filterTickets(
    openTickets,
    new URLSearchParams({ q: filters.query.trim() }),
  ).filter(
    (ticket) =>
      propertyAvailable &&
      (!filters.propertyId || ticket.propertyId === filters.propertyId),
  );
  type OpenTicket = (typeof openTickets)[number];
  const matchesStatus = (ticket: OpenTicket, status: string) =>
    status === "all" || ticket.status === status;
  const isOverdue = (ticket: OpenTicket) =>
    slaState(ticket).state === "overdue";
  const passes = (
    ticket: OpenTicket,
    f: Pick<DashboardFilters, "status" | "deadline" | "unassigned">,
  ) =>
    matchesStatus(ticket, f.status) &&
    (f.deadline === "all" || isOverdue(ticket)) &&
    (!f.unassigned || !ticket.assignedTo);
  const tickets = scopedTickets.filter((ticket) => passes(ticket, filters));
  const urgent = tickets.filter(isCriticalTicket).length;
  // Число на кнопке — сколько заявок останется, если нажать её
  // при остальных включённых фильтрах.
  const overdueCount = scopedTickets.filter((ticket) =>
    passes(ticket, { ...filters, deadline: "overdue" }),
  ).length;
  const unassignedCount = scopedTickets.filter((ticket) =>
    passes(ticket, { ...filters, unassigned: true }),
  ).length;
  const statusCount = (id: string) =>
    scopedTickets.filter((ticket) => passes(ticket, { ...filters, status: id }))
      .length;
  // Основные статусы видны всегда, паузы — когда в них есть заявки.
  const statusTabs = [
    { id: "all", label: "Все" },
    { id: "new", label: "Новые" },
    { id: "accepted", label: "Принятые" },
    { id: "in_progress", label: "В работе" },
    { id: "waiting_tenant", label: "Ждут арендатора" },
    { id: "deferred", label: "Отложены" },
  ]
    .map((tab) => ({ ...tab, count: statusCount(tab.id) }))
    .filter(
      (tab) =>
        !["waiting_tenant", "deferred"].includes(tab.id) ||
        tab.count > 0 ||
        tab.id === filters.status,
    );
  const pathStep = (status: string) =>
    status === "new" ? 0 : status === "accepted" ? 1 : 2;
  const toggleStatus = (id: string) =>
    changeFilters({
      status: id === "all" || filters.status === id ? "all" : id,
    });
  const showPropertyFilter =
    overview.properties.length > 1 || Boolean(filters.propertyId);
  const percent = (value: number) =>
    `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}\u00a0%`;
  // Объекты: занятость по площади, как в шахматке, и открытые заявки.
  const propertySummary = overview.properties.map((property) => {
    const units = overview.units.filter(
      (unit) => unit.propertyId === property.id,
    );
    const total = units.reduce((sum, unit) => sum + Number(unit.area || 0), 0);
    const occupied = units
      .filter((unit) => unit.status === "occupied")
      .reduce((sum, unit) => sum + Number(unit.area || 0), 0);
    return {
      id: property.id,
      name: property.name,
      total,
      occupied,
      share: total ? (occupied / total) * 100 : 0,
      open: openTickets.filter((ticket) => ticket.propertyId === property.id)
        .length,
    };
  });
  // Договоры, срок которых заканчивается в ближайшие 90 дней.
  const expiringLeases = overview.leases
    .filter((lease) =>
      ["signed", "active", "prolongation"].includes(lease.stage),
    )
    .map((lease) => ({ lease, days: daysUntil(lease.endDate) }))
    .filter(
      (
        item,
      ): item is { lease: (typeof overview.leases)[number]; days: number } =>
        item.days !== null && item.days >= 0 && item.days <= 90,
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  return (
    <section className="mvp-page dashboard-page dashboard-workspace">
      <div className="mvp-page-header">
        <h2>{managerUi.titles.dashboard}</h2>
        <WorkspaceHeaderActions>
          <IconButton
            label="Сроки и работы"
            title={
              overview.expiringLeaseCount > 0
                ? `Сроки и работы · К продлению: ${overview.expiringLeaseCount}`
                : "Сроки и работы"
            }
            onClick={() => setManagerScreen("agenda")}
          >
            <ActionIcon name="calendar" />
            {overview.expiringLeaseCount > 0 && (
              <span className="dashboard-agenda-count">
                {overview.expiringLeaseCount}
              </span>
            )}
          </IconButton>
          {hasPermission(session.user, "tickets.write") && (
            <IconButton
              label="Создать заявку"
              variant="primary"
              onClick={() => setManagerScreen("ticket-create")}
            >
              <ActionIcon name="plus" />
            </IconButton>
          )}
        </WorkspaceHeaderActions>
      </div>

      <div
        className="dash-status"
        role="group"
        aria-label="Открытые заявки по статусу"
      >
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="dash-status__tab"
            aria-pressed={filters.status === tab.id}
            data-empty={tab.count === 0 || undefined}
            onClick={() => toggleStatus(tab.id)}
          >
            <span>{tab.label}</span>
            <b>{tab.count}</b>
          </button>
        ))}
        <span className="dash-status__sep" aria-hidden="true" />
        <button
          type="button"
          className="dash-status__tab"
          aria-pressed={filters.deadline === "overdue"}
          data-alert={overdueCount > 0 || undefined}
          data-empty={overdueCount === 0 || undefined}
          onClick={() =>
            changeFilters({
              deadline: filters.deadline === "overdue" ? "all" : "overdue",
            })
          }
        >
          <span>Просрочено</span>
          <b>{overdueCount}</b>
        </button>
        <button
          type="button"
          className="dash-status__tab"
          aria-pressed={filters.unassigned}
          data-alert={unassignedCount > 0 || undefined}
          data-empty={unassignedCount === 0 || undefined}
          onClick={() => changeFilters({ unassigned: !filters.unassigned })}
        >
          <span>Без исполнителя</span>
          <b>{unassignedCount}</b>
        </button>
      </div>

      <div className="dash-layout">
        <article className="mvp-card dashboard-tickets">
          <div className="dashboard-list-heading">
            <div className="dashboard-list-title">
              <h3>Открытые заявки</h3>
              <span
                className="dashboard-filter-result"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                Найдено: <strong>{tickets.length}</strong> из{" "}
                {openTickets.length}
                {urgent > 0 && (
                  <span className="dashboard-urgent-count">
                    {" "}
                    · Срочных: {urgent}
                  </span>
                )}
              </span>
            </div>
            <FilterBar className="dashboard-filter-bar">
              <FilterSearch
                label="Поиск"
                placeholder="Номер, тема, помещение"
                value={filters.query}
                onChange={(query) => changeFilters({ query })}
                maxLength={300}
              />
              {showPropertyFilter && (
                <label className="dashboard-filter-property">
                  <span>Объект</span>
                  <Select
                    aria-label="Объект"
                    value={filters.propertyId}
                    onChange={(event) =>
                      changeFilters({ propertyId: event.target.value })
                    }
                  >
                    <option value="">Все объекты</option>
                    {!propertyAvailable && (
                      <option value={filters.propertyId} disabled>
                        Объект недоступен
                      </option>
                    )}
                    {overview.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </FilterBar>
            <div className="ui-actions dashboard-list-actions">
              <ActiveFilters
                items={[]}
                onReset={hasFilters ? resetFilters : undefined}
              />
              <Button
                variant="text"
                className="dash-all-link"
                onClick={() => setManagerScreen("tickets")}
              >
                Все заявки
              </Button>
            </div>
          </div>
          {tickets.length ? (
            <>
              <div className="dashboard-ticket-head" aria-hidden="true">
                <span>Заявка</span>
                <span>Исполнитель</span>
                <span>Путь</span>
                <span>Срок</span>
              </div>
              <div className="dashboard-ticket-list">
                {tickets.map((ticket) => {
                  const sla = getSlaState(ticket, locale);
                  const step = pathStep(ticket.status);
                  const paused =
                    ticket.status === "waiting_tenant" ||
                    ticket.status === "deferred";
                  return (
                    <Button
                      variant="plain"
                      key={ticket.id}
                      data-critical={isCriticalTicket(ticket) || undefined}
                      onClick={() => openTicketDetail(ticket.id)}
                    >
                      <span className="dashboard-ticket-copy">
                        <strong>{ticket.title}</strong>
                        <small className="dashboard-ticket-number">
                          {ticket.number}
                          {[ticket.propertyName, ticket.unitNumber]
                            .filter(Boolean)
                            .map((part) => ` · ${part}`)
                            .join("")}
                          {isCriticalTicket(ticket) && (
                            <span className="dashboard-ticket-urgent">
                              Срочная
                            </span>
                          )}
                        </small>
                      </span>
                      <span
                        className="dashboard-ticket-assignee"
                        data-empty={!ticket.assignedToName || undefined}
                      >
                        {ticket.assignedToName || "Не назначен"}
                      </span>
                      <span
                        className="metro-mini"
                        style={{ "--step": step } as CSSProperties}
                        data-paused={paused || undefined}
                        title={getTicketStatusLabel(ticket.status, locale)}
                      >
                        {[0, 1, 2, 3].map((index) => (
                          <i
                            key={index}
                            data-state={
                              index < step
                                ? "done"
                                : index === step
                                  ? "current"
                                  : "todo"
                            }
                          />
                        ))}
                        <span className="metro-mini__label">
                          {getTicketStatusLabel(ticket.status, locale)}
                        </span>
                      </span>
                      <small
                        className="dashboard-ticket-sla"
                        data-tone={sla.tone}
                      >
                        {sla.label}
                      </small>
                    </Button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              {!propertyAvailable
                ? "Выбранный объект недоступен. Выберите другой объект или сбросьте фильтры."
                : hasFilters
                  ? "По этим фильтрам заявок нет. Снимите один из фильтров или сбросьте все."
                  : "Открытых заявок нет."}
            </div>
          )}
        </article>

        <aside className="dash-side" aria-label="Объекты и договоры">
          <section className="dash-side__block">
            <div className="dash-side__head">
              <h3>Объекты</h3>
              <Button
                variant="text"
                className="dash-side__link"
                onClick={() => setManagerScreen("units")}
              >
                Помещения
              </Button>
            </div>
            <ul className="dash-props">
              {propertySummary.map((property) => (
                <li key={property.id}>
                  <div className="dash-props__row">
                    <strong>{property.name}</strong>
                    <span>{percent(property.share)}</span>
                  </div>
                  <div className="dash-props__bar" aria-hidden="true">
                    <span style={{ width: `${property.share}%` }} />
                  </div>
                  <small>
                    Занято {formatArea(property.occupied, locale)} из{" "}
                    {formatArea(property.total, locale)}
                    {property.open > 0 && ` · заявок: ${property.open}`}
                  </small>
                </li>
              ))}
            </ul>
          </section>
          <section className="dash-side__block">
            <div className="dash-side__head">
              <h3>К продлению</h3>
              <Button
                variant="text"
                className="dash-side__link"
                onClick={() => setManagerScreen("leases")}
              >
                Договоры
              </Button>
            </div>
            {expiringLeases.length ? (
              <ul className="dash-leases">
                {expiringLeases.map(({ lease, days }) => (
                  <li key={lease.id}>
                    <div>
                      <strong>
                        {lease.tenantName ?? "Арендатор не указан"}
                      </strong>
                      <small>
                        {lease.contractNumber} · {lease.unitNumber ?? "—"}
                      </small>
                    </div>
                    <div className="dash-leases__when">
                      <span>
                        {new Date(lease.endDate).toLocaleDateString("ru-RU")}
                      </span>
                      <small>через {days} дн.</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-side__empty">
                В ближайшие 90 дней договоры не заканчиваются.
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
