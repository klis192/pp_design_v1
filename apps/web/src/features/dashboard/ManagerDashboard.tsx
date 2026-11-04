import { useEffect, useState } from "react";
import {
  isCriticalTicket,
  isOpenTicket,
  slaState,
} from "../../../../../packages/contracts/src/domain";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
import { filterTickets } from "../../../../../packages/contracts/src/ticket-search";
import { useWorkspace } from "../../app/WorkspaceContext";
import { ticketStatusOptions } from "../../projectData";
import { getSlaState, getTicketStatusLabel } from "../../shared/format";
import { NavigationIcon } from "../shell/NavigationIcon";
import { Button, IconButton, Select } from "../../ui";
import { ActionIcon } from "../business/ActionIcon";
import { ActiveFilters, FilterBar, FilterSearch } from "../business/FilterBar";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import "../administration/management-mobile.css";

type DashboardFilters = {
  query: string;
  propertyId: string;
  status: string;
  deadline: "all" | "overdue";
};

const openStatuses = ticketStatusOptions.filter(isOpenTicket);
const defaultFilters: DashboardFilters = {
  query: "",
  propertyId: "",
  status: "all",
  deadline: "all",
};

function readFilters(key: string): DashboardFilters {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return { ...defaultFilters };
    return {
      query: typeof value.query === "string" ? value.query.slice(0, 300) : "",
      propertyId: typeof value.propertyId === "string" ? value.propertyId : "",
      status:
        value.status === "unassigned" || openStatuses.includes(value.status)
          ? value.status
          : "all",
      deadline: value.deadline === "overdue" ? "overdue" : "all",
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
    filters.deadline !== "all";
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
  const tickets = filterTickets(
    openTickets,
    new URLSearchParams({ q: filters.query.trim() }),
  ).filter(
    (ticket) =>
      propertyAvailable &&
      (!filters.propertyId || ticket.propertyId === filters.propertyId) &&
      (filters.status === "all" ||
        (filters.status === "unassigned"
          ? !ticket.assignedTo
          : ticket.status === filters.status)) &&
      (filters.deadline === "all" || slaState(ticket).state === "overdue"),
  );
  const urgent = tickets.filter(isCriticalTicket).length;
  const showPropertyFilter =
    overview.properties.length > 1 || Boolean(filters.propertyId);
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
              Найдено: <strong>{tickets.length}</strong> из {openTickets.length}
              {urgent > 0 && (
                <span className="dashboard-urgent-count">
                  {" "}
                  · Срочных: {urgent}
                </span>
              )}
            </span>
          </div>
          <div className="ui-actions dashboard-list-actions">
            <ActiveFilters
              items={[]}
              onReset={hasFilters ? resetFilters : undefined}
            />
            <IconButton
              label="Все заявки"
              onClick={() => setManagerScreen("tickets")}
            >
              <ActionIcon name="next" />
            </IconButton>
          </div>
        </div>
        <FilterBar className="dashboard-filter-bar">
          <FilterSearch
            label="Поиск"
            placeholder="Поиск заявок"
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
                <option value="">Все доступные объекты</option>
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
          <label className="dashboard-filter-status">
            <span>Статус</span>
            <Select
              aria-label="Статус или назначение"
              value={filters.status}
              onChange={(event) =>
                changeFilters({ status: event.target.value })
              }
            >
              <option value="all">Все открытые</option>
              <option value="unassigned">Не назначены</option>
              {openStatuses.map((status) => (
                <option key={status} value={status}>
                  {getTicketStatusLabel(status, locale)}
                </option>
              ))}
            </Select>
          </label>
          <label className="dashboard-filter-deadline">
            <span>Срок</span>
            <Select
              aria-label="Срок"
              value={filters.deadline}
              onChange={(event) =>
                changeFilters({
                  deadline:
                    event.target.value === "overdue" ? "overdue" : "all",
                })
              }
            >
              <option value="all">Все сроки</option>
              <option value="overdue">Просрочены</option>
            </Select>
          </label>
        </FilterBar>
        {tickets.length ? (
          <div className="dashboard-ticket-list">
            {tickets.map((ticket) => (
              <Button
                variant="plain"
                key={ticket.id}
                onClick={() => openTicketDetail(ticket.id)}
              >
                <span className="dashboard-ticket-copy">
                  <small className="dashboard-ticket-number">
                    {ticket.number}
                    {isCriticalTicket(ticket) && (
                      <span className="dashboard-ticket-urgent">Срочная</span>
                    )}
                  </small>
                  <strong>{ticket.title}</strong>
                  <small>
                    {[ticket.propertyName, ticket.unitNumber]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="dashboard-ticket-assignee">
                  {ticket.assignedToName || "Исполнитель не назначен"}
                </span>
                <span className="dashboard-ticket-state">
                  <span className="dashboard-ticket-status">
                    {getTicketStatusLabel(ticket.status, locale)}
                  </span>
                  <small
                    className="dashboard-ticket-sla"
                    data-tone={getSlaState(ticket, locale).tone}
                  >
                    {getSlaState(ticket, locale).label}
                  </small>
                </span>
                <NavigationIcon name="forward" />
              </Button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {!propertyAvailable
              ? "Выбранный объект недоступен. Выберите другой объект или сбросьте фильтры."
              : hasFilters
                ? "По этим фильтрам заявок нет. Измените условия или сбросьте фильтры."
                : "Открытых заявок нет."}
          </div>
        )}
      </article>
    </section>
  );
}
