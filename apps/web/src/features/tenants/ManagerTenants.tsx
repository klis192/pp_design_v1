import { ActionIcon } from "../business/ActionIcon";
import { IconButton } from "../../ui";
import { useWorkspace } from "../../app/WorkspaceContext";
import { riskLevelOptions } from "../../projectData";
import { ResponsiveTable } from "../../ResponsiveTable";
import { FilterBar, FilterSearch } from "../business/FilterBar";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import {
  countLabel,
  formatArea,
  formatCompactMoney,
  formatDate,
} from "../../shared/format";
import { Button, Select } from "../../ui";
export function ManagerTenants() {
  const {
    managerUi,
    propertyScopedTenantRows,
    setTenantSearch,
    locale,
    tenantSearch,
    setTenantRiskFilter,
    tenantRiskFilter,
    t,
    setManagerScreen,
    cancelAdminEdit,
    setAdminPanel,
    overview,
    selectedPropertyId,
    handleManagerPropertySelect,
    ui,
    openTenantDetail,
    openManagerTenantEdit,
    adminEditLabel,
    canDeletePortfolioItems,
    handleDelete,
  } = useWorkspace();
  return (
    <section className="mvp-page">
      <div className="mvp-page-header">
        <div>
          <h2>{managerUi.titles.tenants}</h2>
          <p>
            {countLabel(propertyScopedTenantRows.length, [
              "арендатор",
              "арендатора",
              "арендаторов",
            ])}
          </p>
        </div>
        <WorkspaceHeaderActions>
          <IconButton
            label={managerUi.import}
            onClick={() => setManagerScreen("import")}
            type="button"
          >
            <ActionIcon name="upload" />
          </IconButton>
          <IconButton
            label="Добавить арендатора"
            variant="primary"
            onClick={() => {
              cancelAdminEdit("tenant");
              setAdminPanel("tenant");
              setManagerScreen("tenant-add");
            }}
            type="button"
          >
            <ActionIcon name="plus" />
          </IconButton>
        </WorkspaceHeaderActions>
      </div>
      <FilterBar>
        <FilterSearch
          label="Поиск арендаторов"
          placeholder={
            locale === "ru" ? "Название, ИНН, контакт" : "Name, tax ID, contact"
          }
          value={tenantSearch}
          onChange={setTenantSearch}
        />
        <label>
          Объект
          <Select
            value={selectedPropertyId}
            onChange={(event) =>
              handleManagerPropertySelect(event.target.value, "tenants")
            }
          >
            {overview.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Риск
          <Select
            onChange={(event) => setTenantRiskFilter(event.target.value)}
            value={tenantRiskFilter}
          >
            <option value="all">
              {locale === "ru" ? "Все риски" : "All risks"}
            </option>
            {riskLevelOptions.map((option) => (
              <option key={option} value={option}>
                {t.riskLevels[option]}
              </option>
            ))}
          </Select>
        </label>
      </FilterBar>

      <article className="mvp-card">
        <div
          className="mvp-table-wrap selection-stage"
          key={`manager-tenants-${selectedPropertyId}`}
        >
          <ResponsiveTable className="mvp-table">
            <thead>
              <tr>
                <th>{managerUi.nav.tenants}</th>
                <th>{t.fields.unit}</th>
                <th>{t.fields.area}</th>
                <th>{ui.monthlyRent}</th>
                <th>{ui.nextExpiry}</th>
                <th>{t.metrics.openTickets}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propertyScopedTenantRows.map((tenant) => (
                <tr key={tenant.id} onClick={() => openTenantDetail(tenant.id)}>
                  <td>
                    <strong>{tenant.name}</strong>
                    <small>
                      {
                        t.riskLevels[
                          tenant.riskLevel as keyof typeof t.riskLevels
                        ]
                      }
                    </small>
                  </td>
                  <td>{tenant.unitLabel}</td>
                  <td>{formatArea(tenant.totalArea, locale)}</td>
                  <td>{formatCompactMoney(tenant.monthlyRent, locale)}</td>
                  <td>{formatDate(tenant.nextExpiry, locale)}</td>
                  <td>{tenant.openTicketCount}</td>
                  <td>
                    <IconButton
                      label={adminEditLabel}
                      onClick={(event) => {
                        event.stopPropagation();
                        openManagerTenantEdit(tenant);
                      }}
                      type="button"
                    >
                      <ActionIcon name="edit" />
                    </IconButton>
                    {canDeletePortfolioItems ? (
                      <Button
                        variant="text"
                        className="text-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(`/api/tenants/${tenant.id}`);
                        }}
                        type="button"
                      >
                        {t.actions.delete}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
        {propertyScopedTenantRows.length === 0 ? (
          <div className="empty-state">{t.hints.noData}</div>
        ) : null}
      </article>
    </section>
  );
}
