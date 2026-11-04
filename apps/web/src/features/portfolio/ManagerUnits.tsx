import { ActionIcon } from "../business/ActionIcon";
import { IconButton } from "../../ui";
import { useWorkspace } from "../../app/WorkspaceContext";
import { StructureWorkspace } from "../platform/StructureWorkspace";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
import { unitStatusOptions, unitTypeOptions } from "../../projectData";
import { ResponsiveTable } from "../../ResponsiveTable";
import { countLabel, formatArea } from "../../shared/format";
import { Select } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import {
  useSurfaceView,
  useVisitedSurfaceViews,
} from "../operations/useSurfaceView";
import "./workspace.css";
export function ManagerUnits() {
  const {
    managerUi,
    filteredPropertyScopedUnits,
    setUnitTypeFilter,
    unitTypeFilter,
    locale,
    t,
    setUnitStatusFilter,
    unitStatusFilter,
    setUnitRampFilter,
    unitRampFilter,
    cancelAdminEdit,
    setAdminPanel,
    setManagerScreen,
    overview,
    selectedPropertyId,
    handleManagerPropertySelect,
    session,
    tickets,
    operations,
    openUnitDetail,
    openTicketDetail,
    openManagerUnitEdit,
    adminEditLabel,
    canDeletePortfolioItems,
    handleDelete,
  } = useWorkspace();
  const [view, setView] = useSurfaceView(
    `wirehouse.view.units:${session.user.id}:${selectedPropertyId}`,
    "list",
    ["list", "structure", "plans"] as const,
  );
  const visited = useVisitedSurfaceViews(selectedPropertyId, view);
  return (
    <section className="mvp-page portfolio-page">
      <div className="mvp-page-header">
        <div>
          <h2>{managerUi.titles.units}</h2>
          <p>
            {countLabel(filteredPropertyScopedUnits.length, [
              "помещение",
              "помещения",
              "помещений",
            ])}
          </p>
        </div>
        <WorkspaceHeaderActions>
          <IconButton
            label="Добавить помещение"
            variant="primary"
            onClick={() => {
              cancelAdminEdit("unit");
              setAdminPanel("unit");
              setManagerScreen("unit-add");
            }}
            type="button"
          >
            <ActionIcon name="plus" />
          </IconButton>
        </WorkspaceHeaderActions>
      </div>

      <div className="workspace-context-row">
        <label>
          Объект
          <Select
            value={selectedPropertyId}
            onChange={(event) =>
              handleManagerPropertySelect(event.target.value, "units")
            }
          >
            {overview.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <WorkspaceTabs
        idPrefix="units-view"
        label="Помещения: представление"
        value={view}
        onChange={(id) => setView(id as typeof view)}
        items={[
          { id: "list", label: "Список" },
          { id: "structure", label: "Структура" },
          { id: "plans", label: "Планы" },
        ]}
      />
      <div
        className="workspace-pane"
        role="tabpanel"
        id={`units-view-panel-${view}`}
        aria-labelledby={`units-view-tab-${view}`}
      >
        {view === "list" && (
          <div className="workspace-filter-row">
            <label>
              Тип помещения
              <Select
                className="filter-select"
                aria-label="Тип помещения"
                onChange={(event) => setUnitTypeFilter(event.target.value)}
                value={unitTypeFilter}
              >
                <option value="all">
                  {locale === "ru"
                    ? "\u0412\u0441\u0435 \u0442\u0438\u043f\u044b"
                    : "All types"}
                </option>
                {unitTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {t.unitTypes[option]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Статус помещения
              <Select
                className="filter-select"
                aria-label="Статус помещения"
                onChange={(event) => setUnitStatusFilter(event.target.value)}
                value={unitStatusFilter}
              >
                <option value="all">
                  {locale === "ru"
                    ? "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b"
                    : "All statuses"}
                </option>
                {unitStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {t.unitStatuses[option]}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Наличие рампы
              <Select
                className="filter-select"
                aria-label="Наличие рампы"
                onChange={(event) => setUnitRampFilter(event.target.value)}
                value={unitRampFilter}
              >
                <option value="all">
                  {locale === "ru"
                    ? "\u0412\u0441\u0435 \u0440\u0430\u043c\u043f\u044b"
                    : "All ramps"}
                </option>
                <option value="ramp">{t.fields.hasRamp}</option>
                <option value="no-ramp">
                  {locale === "ru"
                    ? "\u0411\u0435\u0437 \u0440\u0430\u043c\u043f\u044b"
                    : "No ramp"}
                </option>
              </Select>
            </label>
          </div>
        )}
        {view === "list" && (
          <article
            className="mvp-card selection-stage"
            key={`manager-units-${selectedPropertyId}`}
          >
            <div className="mvp-table-wrap">
              <ResponsiveTable className="mvp-table">
                <thead>
                  <tr>
                    <th>{t.fields.unit}</th>
                    <th>{t.fields.area}</th>
                    <th>{t.fields.type}</th>
                    <th>{managerUi.unitMeta}</th>
                    <th>{t.fields.status}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPropertyScopedUnits.map((unit) => (
                    <tr key={unit.id} onClick={() => openUnitDetail(unit.id)}>
                      <td>
                        <strong>
                          {unit.propertyName ?? "—"} · {unit.number}
                        </strong>
                        <small>{unit.tenantName ?? t.hints.noData}</small>
                      </td>
                      <td>{formatArea(unit.area, locale)}</td>
                      <td>
                        {t.unitTypes[unit.type as keyof typeof t.unitTypes]}
                      </td>
                      <td>{unit.temperatureRegime || "—"}</td>
                      <td>
                        {
                          t.unitStatuses[
                            unit.status as keyof typeof t.unitStatuses
                          ]
                        }
                      </td>
                      <td>
                        <IconButton
                          label={adminEditLabel}
                          onClick={(event) => {
                            event.stopPropagation();
                            openManagerUnitEdit(unit);
                          }}
                          type="button"
                        >
                          <ActionIcon name="edit" />
                        </IconButton>
                        {canDeletePortfolioItems ? (
                          <IconButton
                            label={t.actions.delete}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(`/api/units/${unit.id}`);
                            }}
                            type="button"
                          >
                            <ActionIcon name="delete" />
                          </IconButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
            </div>
            {filteredPropertyScopedUnits.length === 0 ? (
              <div className="empty-state">{t.hints.noData}</div>
            ) : null}
          </article>
        )}
        {(["structure", "plans"] as const)
          .filter((mode) => visited.includes(mode))
          .map((mode) => (
            <article
              className="workspace-pane"
              key={`${selectedPropertyId}:${mode}`}
              hidden={view !== mode}
            >
              <StructureWorkspace
                embedded
                view={mode === "plans" ? "plans" : "tree"}
                token={session.token}
                canWrite={hasPermission(session.user, "plans.write")}
                properties={overview.properties.filter(
                  (p) => !selectedPropertyId || p.id === selectedPropertyId,
                )}
                units={overview.units}
                tickets={tickets}
                equipment={operations?.equipment ?? []}
                onUnit={openUnitDetail}
                onTicket={openTicketDetail}
              />
            </article>
          ))}
      </div>
    </section>
  );
}
