import { useWorkspace } from "../../app/WorkspaceContext";
import { useState } from "react";
import { DispatchWorkspace } from "../business/DispatchWorkspace";
import { filterTickets } from "../../../../../packages/contracts/src/ticket-search";
import { ticketCategoryOptions } from "../../projectData";
import { ticketStatusOptions } from "../../projectData";
import { ResponsiveTable } from "../../ResponsiveTable";
import {
  formatDate,
  getSlaState,
  getTicketStatusLabel,
} from "../../shared/format";
import { type TicketFilter } from "../../shared/types";
import { Button, IconButton, Checkbox, Select, Input } from "../../ui";
import { ActionIcon } from "../business/ActionIcon";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { useWorkspaceViewState } from "../../ui/useWorkspaceViewState";
import { SidePanel } from "../../ui/SidePanel";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import { ActiveFilters, FilterBar, FilterSearch } from "../business/FilterBar";
import "./workspace.css";
export function ManagerTickets() {
  const [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [category, setCategory] = useState(""),
    [unitId, setUnitId] = useState(""),
    [applicant, setApplicant] = useState(""),
    [archive, setArchive] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const {
    managerUi,
    setTicketView,
    ticketView,
    setTicketFilter,
    ticketFilter,
    locale,
    t,
    setManagerScreen,
    moveBoardTicket,
    filteredTickets: availableTickets,
    openTicketDetail,
    busyAction,
    session,
  } = useWorkspace();
  const [workspaceMode, setWorkspaceMode] = useWorkspaceViewState(
    `wirehouse.ticket-list.view:${session.user.id}`,
    "tickets",
    ["tickets", "dispatch"] as const,
  );
  const filteredTickets = filterTickets(
    availableTickets,
    new URLSearchParams({
      q: query,
      from,
      to,
      category,
      unitId,
      createdBy: applicant,
      archive: String(archive),
    }),
  );
  const activeFilters = [
    ...(from
      ? [
          {
            key: "from",
            label: `Создана с ${formatDate(from, locale)}`,
            onClear: () => setFrom(""),
          },
        ]
      : []),
    ...(to
      ? [
          {
            key: "to",
            label: `Создана по ${formatDate(to, locale)}`,
            onClear: () => setTo(""),
          },
        ]
      : []),
    ...(category
      ? [
          {
            key: "category",
            label:
              t.ticketCategories[category as keyof typeof t.ticketCategories],
            onClear: () => setCategory(""),
          },
        ]
      : []),
    ...(unitId
      ? [
          {
            key: "unit",
            label: `Помещение ${availableTickets.find((ticket) => ticket.unitId === unitId)?.unitNumber ?? "—"}`,
            onClear: () => setUnitId(""),
          },
        ]
      : []),
    ...(applicant
      ? [
          {
            key: "applicant",
            label:
              availableTickets.find((ticket) => ticket.createdBy === applicant)
                ?.createdByName ?? "Заявитель",
            onClear: () => setApplicant(""),
          },
        ]
      : []),
    ...(archive
      ? [
          {
            key: "archive",
            label: "Выполненные и архив",
            onClear: () => setArchive(false),
          },
        ]
      : []),
  ];
  const resetFilters = () => {
    setQuery("");
    setTicketFilter("all");
    setFrom("");
    setTo("");
    setCategory("");
    setUnitId("");
    setApplicant("");
    setArchive(false);
  };
  return (
    <section className="mvp-page ticket-list-page">
      <div className="mvp-page-header">
        <div>
          <h2>{managerUi.titles.tickets}</h2>
        </div>
        <WorkspaceHeaderActions>
          <IconButton
            label="Создать заявку"
            variant="primary"
            onClick={() => setManagerScreen("ticket-create")}
            type="button"
          >
            <ActionIcon name="plus" />
          </IconButton>
        </WorkspaceHeaderActions>
      </div>

      <WorkspaceTabs
        label="Работа с заявками"
        idPrefix="ticket-list"
        value={workspaceMode}
        onChange={(value) =>
          setWorkspaceMode(value === "dispatch" ? "dispatch" : "tickets")
        }
        items={[
          { id: "tickets", label: "Заявки", count: availableTickets.length },
          { id: "dispatch", label: "Службы и маршруты" },
        ]}
      />
      <div
        hidden={workspaceMode !== "tickets"}
        role="tabpanel"
        id="ticket-list-panel-tickets"
        aria-labelledby="ticket-list-tab-tickets"
        className="workspace-pane"
      >
        <FilterBar
          className="ticket-filter-bar"
          actions={
            <>
              <span
                className="ticket-filter-action"
                data-filter-count={activeFilters.length || undefined}
              >
                <IconButton
                  label="Фильтры заявок"
                  title={
                    activeFilters.length
                      ? `Фильтры заявок · Применено: ${activeFilters.length}`
                      : "Фильтры заявок"
                  }
                  aria-pressed={activeFilters.length > 0}
                  aria-haspopup="dialog"
                  onClick={() => setFiltersOpen(true)}
                >
                  <ActionIcon name="filter" />
                </IconButton>
              </span>
              <div className="view-switch" role="group" aria-label="Вид заявок">
                <IconButton
                  label="Список"
                  aria-pressed={ticketView === "table"}
                  onClick={() => setTicketView("table")}
                >
                  <ActionIcon name="list" />
                </IconButton>
                <IconButton
                  label="Канбан"
                  aria-pressed={ticketView === "board"}
                  onClick={() => setTicketView("board")}
                >
                  <ActionIcon name="board" />
                </IconButton>
              </div>
            </>
          }
          summary={
            <>
              <span
                className="ticket-filter-result"
                role="status"
                aria-live="polite"
              >
                Найдено: <strong>{filteredTickets.length}</strong>
              </span>
              <ActiveFilters
                items={activeFilters}
                onReset={
                  activeFilters.length || query || ticketFilter !== "all"
                    ? resetFilters
                    : undefined
                }
              />
            </>
          }
        >
          <FilterSearch
            label="Поиск"
            ariaLabel="Поиск по номеру, тексту, помещению, заявителю"
            placeholder="Номер, текст, помещение, заявитель"
            value={query}
            onChange={setQuery}
            maxLength={300}
          />
          <label className="ticket-status-filter">
            <span>Статус</span>
            <Select
              aria-label="Статус заявки"
              onChange={(event) =>
                setTicketFilter(event.target.value as TicketFilter)
              }
              value={ticketFilter}
            >
              <option value="all">
                {locale === "ru" ? "Все статусы" : "All"}
              </option>
              {ticketStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {t.ticketStatuses[status]}
                </option>
              ))}
            </Select>
          </label>
        </FilterBar>
        <SidePanel
          title="Фильтры заявок"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          footer={
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Готово
            </Button>
          }
        >
          <div className="form-grid ticket-advanced-filters">
            <label>
              Создана с
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Создана по
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              Категория
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Все категории</option>
                {ticketCategoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {t.ticketCategories[c as keyof typeof t.ticketCategories]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Помещение
              <Select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Все помещения</option>
                {[
                  ...new Map(
                    availableTickets.map((t) => [
                      t.unitId,
                      {
                        id: t.unitId,
                        label: `${t.propertyName ?? ""} · ${t.unitNumber ?? ""}`,
                      },
                    ]),
                  ).values(),
                ].map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Заявитель
              <Select
                value={applicant}
                onChange={(e) => setApplicant(e.target.value)}
              >
                <option value="">Все заявители</option>
                {[
                  ...new Map(
                    availableTickets.map((t) => [
                      t.createdBy,
                      { id: t.createdBy, name: t.createdByName ?? t.createdBy },
                    ]),
                  ).values(),
                ].map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </label>
            <Checkbox
              checked={archive}
              onChange={(e) => setArchive(e.target.checked)}
            >
              Только выполненные и архив
            </Checkbox>
          </div>
        </SidePanel>
        {ticketView === "board" ? (
          <div className="kanban-board">
            {[
              { id: "new", label: "Новые", statuses: ["new", "accepted"] },
              {
                id: "in_progress",
                label: "В работе",
                statuses: ["in_progress"],
              },
              {
                id: "waiting_tenant",
                label: "Ожидание",
                statuses: ["waiting_tenant"],
              },
              { id: "deferred", label: "Отложены", statuses: ["deferred"] },
              {
                id: "completed",
                label: "Выполнены",
                statuses: ["completed", "resolved"],
              },
              {
                id: "closed",
                label: "Закрыты",
                statuses: ["closed", "rejected"],
              },
            ].map((column) => (
              <section
                className="kanban-column"
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void moveBoardTicket(
                    event.dataTransfer.getData("text/plain"),
                    column.id,
                  );
                }}
              >
                <h3>
                  {column.label}{" "}
                  <small>
                    {
                      filteredTickets.filter((t) =>
                        column.statuses.includes(t.status),
                      ).length
                    }
                  </small>
                </h3>
                {!filteredTickets.some((ticket) =>
                  column.statuses.includes(ticket.status),
                ) && <p className="kanban-empty">Заявок нет</p>}
                {filteredTickets
                  .filter((t) => column.statuses.includes(t.status))
                  .map((ticket) => (
                    <article
                      className="kanban-ticket"
                      draggable
                      key={ticket.id}
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", ticket.id)
                      }
                    >
                      <Button
                        variant="plain"
                        type="button"
                        className="kanban-ticket-open"
                        onClick={() => openTicketDetail(ticket.id)}
                      >
                        <span className="record-number">{ticket.number}</span>
                        <strong>{ticket.title}</strong>
                      </Button>
                      <p className="kanban-ticket-location">
                        {ticket.propertyName} · {ticket.unitNumber}
                      </p>
                      <small className="kanban-ticket-assignee">
                        {ticket.assignedToName || "Исполнитель не назначен"}
                      </small>
                      <span
                        className={`status-pill status-pill--${getSlaState(ticket, locale).tone}`}
                      >
                        {getSlaState(ticket, locale).label}
                      </span>
                      <Select
                        aria-label={`Статус ${ticket.number}`}
                        value={ticket.status}
                        disabled={Boolean(busyAction)}
                        onChange={(event) =>
                          void moveBoardTicket(ticket.id, event.target.value)
                        }
                      >
                        {ticketStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {getTicketStatusLabel(status, locale)}
                          </option>
                        ))}
                      </Select>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        ) : (
          <article className="ticket-table data-register data-register--comfortable">
            <div className="mvp-table-wrap">
              <ResponsiveTable className="mvp-table register-table ticket-register-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>{t.fields.title}</th>
                    <th>{t.fields.tenant}</th>
                    <th>{t.fields.priority}</th>
                    <th>{t.fields.status}</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => openTicketDetail(ticket.id)}
                    >
                      <td className="ticket-cell-number">{ticket.number}</td>
                      <td className="register-cell--primary">
                        <strong>{ticket.title}</strong>
                        <small>
                          {ticket.propertyName ?? "—"} ·{" "}
                          {ticket.unitNumber ?? "—"}
                        </small>
                      </td>
                      <td>{ticket.tenantName ?? "—"}</td>
                      <td>
                        {
                          t.ticketPriorities[
                            ticket.priority as keyof typeof t.ticketPriorities
                          ]
                        }
                      </td>
                      <td>
                        {
                          t.ticketStatuses[
                            ticket.status as keyof typeof t.ticketStatuses
                          ]
                        }
                      </td>
                      <td>
                        <span
                          className={`status-pill status-pill--${getSlaState(ticket, locale).tone}`}
                        >
                          {getSlaState(ticket, locale).label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
            </div>
            {filteredTickets.length === 0 ? (
              <div className="empty-state">{t.hints.ticketEmpty}</div>
            ) : null}
          </article>
        )}
      </div>
      <div
        hidden={workspaceMode !== "dispatch"}
        role="tabpanel"
        id="ticket-list-panel-dispatch"
        aria-labelledby="ticket-list-tab-dispatch"
      >
        <DispatchWorkspace />
      </div>
    </section>
  );
}
