import { ActionIcon } from "../business/ActionIcon";
import { useEffect } from "react";
import { useWorkspace } from "../../app/WorkspaceContext";
import { type AdminPanel, type ManagerScreen } from "../../shared/types";
import { IconButton } from "../../ui";
import { AdminForm } from "../administration/AdminForm";
export function ManagerFormScreen({
  screen,
  backScreen,
}: {
  screen: "tenant-add" | "property-add" | "unit-add" | "lease-add";
  backScreen: ManagerScreen;
}) {
  const {
    editingAdmin,
    adminSaveChangesLabel,
    managerUi,
    cancelAdminEdit,
    setManagerScreen,
    setAdminPanel,
    adminPanel,
  } = useWorkspace();

  const panel: AdminPanel =
    screen === "tenant-add"
      ? "tenant"
      : screen === "property-add"
        ? "property"
        : screen === "unit-add"
          ? "unit"
          : "lease";
  useEffect(() => {
    setAdminPanel(panel);
  }, [panel, setAdminPanel]);
  const isEditing = Boolean(editingAdmin[panel]);
  const title = isEditing
    ? adminSaveChangesLabel
    : screen === "tenant-add"
      ? managerUi.titles.tenantAdd
      : screen === "property-add"
        ? managerUi.titles.propertyAdd
        : screen === "unit-add"
          ? managerUi.titles.unitAdd
          : managerUi.titles.leaseAdd;
  return (
    <section className="mvp-page">
      <div className="mvp-detail-head">
        <IconButton
          label={managerUi.back}
          variant="plain"
          className="mvp-back"
          onClick={() => {
            if (isEditing) {
              cancelAdminEdit(panel);
            }
            if (!isEditing) setManagerScreen(backScreen);
          }}
          type="button"
        >
          <ActionIcon name="back" />
        </IconButton>
        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <article className="mvp-card">
        {adminPanel === panel ? (
          <AdminForm />
        ) : (
          <p role="status">Загрузка формы…</p>
        )}
      </article>
    </section>
  );
}
