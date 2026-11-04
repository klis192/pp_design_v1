import { ActionIcon } from "../business/ActionIcon";
import { useWorkspace } from "../../app/WorkspaceContext";
import { Button, IconButton, Input, Select } from "../../ui";
export function ManagerStaffCreate() {
  const {
    setManagerScreen,
    managerUi,
    handleCreateStaff,
    t,
    handleFieldChange,
    setStaffCreateForm,
    staffCreateForm,
    locale,
    session,
    overview,
    busyAction,
  } = useWorkspace();
  return (
    <section className="mvp-page">
      <div className="mvp-detail-head">
        <IconButton
          label={managerUi.back}
          variant="plain"
          className="mvp-back"
          onClick={() => setManagerScreen("staff")}
          type="button"
        >
          <ActionIcon name="back" />
        </IconButton>
        <div>
          <h2>{managerUi.titles.staffAdd}</h2>
        </div>
      </div>

      <article className="mvp-card">
        <form className="form-grid" onSubmit={handleCreateStaff}>
          <label>
            <span>{t.fields.name}</span>
            <Input
              name="fullName"
              onChange={handleFieldChange(setStaffCreateForm)}
              value={staffCreateForm.fullName}
            />
          </label>
          <label>
            <span>{t.fields.email}</span>
            <Input
              name="email"
              onChange={handleFieldChange(setStaffCreateForm)}
              value={staffCreateForm.email}
            />
          </label>
          <label>
            <span>{managerUi.phoneOptional}</span>
            <Input
              name="phone"
              onChange={handleFieldChange(setStaffCreateForm)}
              value={staffCreateForm.phone}
            />
          </label>
          <label>
            <span>{managerUi.passwordTemp} (от 10 символов)</span>
            <Input
              required
              minLength={10}
              name="password"
              onChange={handleFieldChange(setStaffCreateForm)}
              type="password"
              value={staffCreateForm.password}
            />
          </label>
          <label>
            <span>{locale === "ru" ? "Роль" : "Role"}</span>
            <Select
              name="role"
              onChange={handleFieldChange(setStaffCreateForm)}
              value={staffCreateForm.role}
            >
              <option value="worker">{t.roles.worker}</option>
              {session?.user.role === "admin" ? (
                <option value="manager">{t.roles.manager}</option>
              ) : null}
              {session?.user.role === "admin" ? (
                <option value="admin">{t.roles.admin}</option>
              ) : null}
            </Select>
          </label>
          <label>
            <span>{managerUi.objectScope}</span>
            <Select
              disabled={staffCreateForm.role === "admin"}
              name="propertyId"
              onChange={handleFieldChange(setStaffCreateForm)}
              value={
                staffCreateForm.role === "admin"
                  ? ""
                  : staffCreateForm.propertyId
              }
            >
              {staffCreateForm.role === "admin" ? (
                <option value="">{managerUi.allObjects}</option>
              ) : null}
              {overview.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            className="primary-button"
            disabled={busyAction === "staff-create"}
            type="submit"
          >
            {managerUi.createStaff}
          </Button>
        </form>
      </article>
    </section>
  );
}
