import { ActionIcon } from "../business/ActionIcon";
import { IconButton } from "../../ui";
import { DocumentRegistry } from "../business/DocumentRegistry";
import { useWorkspace } from "../../app/WorkspaceContext";
import { formatArea } from "../../shared/format";
import { Button, Select } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import {
  useSurfaceView,
  useVisitedSurfaceViews,
} from "../operations/useSurfaceView";
import "./workspace.css";
import { StructureWorkspace } from "../platform/StructureWorkspace";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
export function ManagerObjects() {
  const {
    session,
    overview,
    tickets,
    operations,
    openTicketDetail,
    managerUi,
    setManagerScreen,
    locale,
    cancelAdminEdit,
    setAdminPanel,
    propertyOperations,
    selectedPropertyId,
    handleManagerPropertySelect,
    t,
    selectedPropertySnapshot,
    selectedProperty,
    openManagerPropertyEdit,
    adminEditLabel,
    canDeletePortfolioItems,
    canManagePortfolio,
    handleDelete,
    openUnitDetail,
  } = useWorkspace();
  const [view, setView] = useSurfaceView(
    `wirehouse.view.objects:${session.user.id}:${selectedPropertyId}`,
    "overview",
    ["overview", "structure", "plans", "documents"] as const,
  );
  const visited = useVisitedSurfaceViews(selectedPropertyId, view);
  const activeProperty = propertyOperations.find(
    (p) => p.id === selectedPropertyId,
  );
  return (
    <section className="mvp-page portfolio-page">
      <div className="mvp-page-header">
        <div>
          <h2>{managerUi.titles.objects}</h2>
        </div>
        {canManagePortfolio && (
          <div className="mvp-actions">
            <Button
              variant="primary"
              className="primary-button"
              onClick={() => setManagerScreen("object-launch")}
              type="button"
            >
              {locale === "ru" ? "Запустить объект" : "Launch"}
            </Button>
            <IconButton
              label={managerUi.add}
              onClick={() => {
                cancelAdminEdit("property");
                setAdminPanel("property");
                setManagerScreen("property-add");
              }}
              type="button"
            >
              <ActionIcon name="plus" />
            </IconButton>
          </div>
        )}
      </div>

      <div className="workspace-context-row">
        <label>
          Объект
          <Select
            value={selectedPropertyId}
            onChange={(event) =>
              handleManagerPropertySelect(event.target.value, "objects")
            }
          >
            {propertyOperations.map((property) => (
              <option value={property.id} key={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </label>
        {selectedProperty && canManagePortfolio && (
          <div className="mvp-actions">
            <IconButton
              label={adminEditLabel}
              onClick={() => openManagerPropertyEdit(selectedProperty)}
            >
              <ActionIcon name="edit" />
            </IconButton>
            {canDeletePortfolioItems && (
              <IconButton
                label="Удалить объект"
                onClick={() =>
                  void handleDelete(`/api/properties/${selectedProperty.id}`)
                }
              >
                <ActionIcon name="delete" />
              </IconButton>
            )}
          </div>
        )}
      </div>
      <WorkspaceTabs
        idPrefix="objects-view"
        label="Объект: представление"
        value={view}
        onChange={(id) => setView(id as typeof view)}
        items={[
          { id: "overview", label: "Обзор" },
          { id: "structure", label: "Структура" },
          { id: "plans", label: "Планы" },
          { id: "documents", label: "Документы" },
        ]}
      />
      <div
        className="workspace-pane"
        role="tabpanel"
        id={`objects-view-panel-${view}`}
        aria-labelledby={`objects-view-tab-${view}`}
      >
        {view === "overview" && activeProperty && (
          <div className="portfolio-summary">
            <span>{activeProperty.address}</span>
            <span>Класс {activeProperty.warehouseClass}</span>
            <span>Заполняемость {activeProperty.occupancy}%</span>
            <span>Открытых заявок: {activeProperty.openTicketCount}</span>
          </div>
        )}
        {view === "overview" && selectedPropertySnapshot ? (
          <article
            className="mvp-card area-split-card selection-stage"
            key={`manager-area-split-${selectedPropertyId}`}
          >
            <div className="mvp-card-head">
              <div>
                <h3>{locale === "ru" ? "Деление площадей" : "Area split"}</h3>
              </div>
              <small>
                {formatArea(selectedPropertySnapshot.rentableArea, locale)}
              </small>
            </div>
            <div
              className="area-split-bar"
              aria-label={
                locale === "ru"
                  ? "Деление площадей по статусам"
                  : "Area split by status"
              }
            >
              {selectedPropertySnapshot.statusBreakdown.map((item) => (
                <span
                  className={`area-split-segment area-split-segment--${item.id}`}
                  key={item.id}
                  style={{
                    width: `${Math.max(2, (item.area / Math.max(1, selectedPropertySnapshot.rentableArea)) * 100)}%`,
                  }}
                  title={`${item.label}: ${formatArea(item.area, locale)}`}
                />
              ))}
            </div>
            <div className="area-split-grid">
              {selectedPropertySnapshot.statusBreakdown.map((item) => (
                <div className="area-split-item" key={item.id}>
                  <span
                    className={`area-split-dot area-split-dot--${item.id}`}
                  />
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {formatArea(item.area, locale)} ·{" "}
                      {Math.round(
                        (item.area /
                          Math.max(1, selectedPropertySnapshot.rentableArea)) *
                          100,
                      )}
                      %
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="area-type-grid">
              {selectedPropertySnapshot.typeBreakdown.map((item) => (
                <div className="area-type-chip" key={item.id}>
                  <span>{item.label}</span>
                  <strong>{formatArea(item.area, locale)}</strong>
                </div>
              ))}
            </div>
          </article>
        ) : null}

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
                properties={overview.properties.filter(
                  (p) => !selectedPropertyId || p.id === selectedPropertyId,
                )}
                units={overview.units}
                tickets={tickets}
                equipment={operations?.equipment ?? []}
                onUnit={openUnitDetail}
                onTicket={openTicketDetail}
                canWrite={hasPermission(session.user, "plans.write")}
              />
            </article>
          ))}
        {view === "documents" && (
          <article className="workspace-pane">
            <DocumentRegistry />
          </article>
        )}
      </div>
    </section>
  );
}
