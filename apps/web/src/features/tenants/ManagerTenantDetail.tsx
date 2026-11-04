import { ActionIcon } from "../business/ActionIcon";
import { useWorkspace } from "../../app/WorkspaceContext";
import { type TenantDetailTab } from "../../shared/types";
import { Button, IconButton } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { TenantInfoTab } from "./components/TenantInfoTab";
import { TenantContractsTab } from "./components/TenantContractsTab";
import { TenantPaymentsTab } from "./components/TenantPaymentsTab";
import { TenantMetersTab } from "./components/TenantMetersTab";
import { TenantNotesTab } from "./components/TenantNotesTab";
import { TenantTicketsTab } from "./components/TenantTicketsTab";
import { TenantRisksTab } from "./components/TenantRisksTab";

export function ManagerTenantDetail() {
  const {
    managerUi,
    t,
    ui,
    setManagerScreen,
    tenantDetail,
    selectedTenant,
    openManagerTenantEdit,
    adminEditLabel,
    canDeletePortfolioItems,
    handleDelete,
    tenantDetailBusy,
    tenantDetailTab,
    setTenantDetailTab,
  } = useWorkspace();

  const tenantTabs: { id: TenantDetailTab; label: string }[] = [
    { id: "info", label: managerUi.baseInfo },
    { id: "contracts", label: t.nav.leases },
    { id: "payments", label: ui.payments },
    {
      id: "meters",
      label: localeText(managerUi, "ru") ? "Счетчики" : "Meters",
    },
    { id: "notes", label: ui.notes },
    { id: "tickets", label: managerUi.nav.tickets },
    { id: "risks", label: ui.risks },
  ];

  function localeText(mUi: typeof managerUi, target: string) {
    return mUi.baseInfo.includes("Базовая") || target === "ru";
  }

  return (
    <section className="mvp-page">
      <div className="mvp-detail-head">
        <IconButton
          label={managerUi.back}
          variant="plain"
          className="mvp-back"
          onClick={() => setManagerScreen("tenants")}
          type="button"
        >
          <ActionIcon name="back" />
        </IconButton>
        <div>
          <h2>
            {tenantDetail?.tenant.name ??
              selectedTenant?.name ??
              managerUi.titles.tenantDetail}
          </h2>
        </div>
        {tenantDetail ? (
          <div className="mvp-actions">
            <IconButton
              label={adminEditLabel}
              onClick={() => openManagerTenantEdit(tenantDetail.tenant)}
              type="button"
            >
              <ActionIcon name="edit" />
            </IconButton>
            {canDeletePortfolioItems ? (
              <Button
                variant="text"
                className="text-button text-button--danger"
                onClick={() =>
                  void handleDelete(`/api/tenants/${tenantDetail.tenant.id}`)
                }
                type="button"
              >
                {t.actions.delete}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {tenantDetailBusy ? (
        <div className="mvp-card">
          <div className="empty-state">{t.loading}</div>
        </div>
      ) : tenantDetail ? (
        <>
          <WorkspaceTabs
            label="Карточка арендатора"
            items={tenantTabs}
            value={tenantDetailTab}
            onChange={(id) => setTenantDetailTab(id as TenantDetailTab)}
          />

          {tenantDetailTab === "info" && <TenantInfoTab />}
          {tenantDetailTab === "contracts" && <TenantContractsTab />}
          {tenantDetailTab === "payments" && <TenantPaymentsTab />}
          {tenantDetailTab === "meters" && <TenantMetersTab />}
          {tenantDetailTab === "notes" && <TenantNotesTab />}
          {tenantDetailTab === "tickets" && <TenantTicketsTab />}
          {tenantDetailTab === "risks" && <TenantRisksTab />}
        </>
      ) : (
        <div className="mvp-card">
          <div className="empty-state">{ui.emptyTenant}</div>
        </div>
      )}
    </section>
  );
}
