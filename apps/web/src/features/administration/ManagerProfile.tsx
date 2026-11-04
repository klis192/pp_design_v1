import { Disclosure } from "../../ui/Disclosure";
import { useWorkspace } from "../../app/WorkspaceContext";
import { BotLinkPanel } from "../../MessengerButtons";
import { Button, Input } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { useWorkspaceViewState } from "../../ui/useWorkspaceViewState";
import {
  permissionLabels,
  Permission,
} from "../../../../../packages/contracts/src/permissions";
export function ManagerProfile() {
  const {
    managerUi,
    session,
    t,
    selectedProperty,
    overview,
    handleLogout,
    totpSetup,
    busyAction,
    handleTotpSetup,
    handleTotpConfirm,
    setTotpSetup,
    handleTotpDisable,
  } = useWorkspace();
  const [view, setView] = useWorkspaceViewState(
    `wirehouse.profile.view:${session.user.id}`,
    "profile",
    ["profile", "security", "messengers"] as const,
  );
  return (
    <section className="mvp-page">
      <div className="mvp-page-header">
        <div>
          <h2>{managerUi.titles.profile}</h2>
        </div>
      </div>

      <WorkspaceTabs
        label="Профиль"
        idPrefix="profile-views"
        value={view}
        onChange={(next) =>
          setView(
            next === "security" || next === "messengers" ? next : "profile",
          )
        }
        items={[
          { id: "profile", label: "Профиль и доступ" },
          { id: "security", label: "Безопасность" },
          { id: "messengers", label: "Мессенджеры" },
        ]}
      />
      <article
        className="mvp-card"
        hidden={view !== "messengers"}
        role="tabpanel"
        id="profile-views-panel-messengers"
        aria-labelledby="profile-views-tab-messengers"
      >
        <BotLinkPanel token={session.token} />
      </article>
      <article
        className="mvp-card"
        hidden={view !== "profile"}
        role="tabpanel"
        id="profile-views-panel-profile"
        aria-labelledby="profile-views-tab-profile"
      >
        <div className="mvp-card-head">
          <div>
            <h3>{session.user.fullName}</h3>
          </div>
        </div>
        <div className="mvp-info-list">
          <div className="mvp-info-row">
            <span>{t.fields.email}</span>
            <strong>{session.user.email ?? "—"}</strong>
          </div>
          <div className="mvp-info-row">
            <span>{managerUi.phoneOptional}</span>
            <strong>{session.user.phone ?? "—"}</strong>
          </div>
          <div className="mvp-info-row">
            <span>{managerUi.profileScope}</span>
            <strong>
              {session.user.permissions.length} разрешённых действий
            </strong>
          </div>
          <div className="mvp-info-row">
            <span>{managerUi.objectScope}</span>
            <strong>
              {session.user.propertyId
                ? overview.properties.find(
                    (p) => p.id === session.user.propertyId,
                  )?.name
                : "Все объекты"}
            </strong>
          </div>
        </div>
        <Disclosure title="Мои права доступа">
          <ul>
            {session.user.permissions.map((p) => (
              <li key={p}>{permissionLabels[p as Permission]}</li>
            ))}
          </ul>
        </Disclosure>
        <Button
          variant="secondary"
          className="secondary-button profile-logout"
          onClick={handleLogout}
          type="button"
        >
          {t.topbar.logout}
        </Button>
      </article>

      <article
        className="mvp-card"
        hidden={view !== "security"}
        role="tabpanel"
        id="profile-views-panel-security"
        aria-labelledby="profile-views-tab-security"
      >
        <div className="mvp-card-head">
          <div>
            <h3>
              {session.user.totpEnabled
                ? managerUi.totpEnabled
                : managerUi.totpDisabled}
            </h3>
          </div>
        </div>

        {!session.user.totpEnabled && !totpSetup ? (
          <Button
            variant="primary"
            className="primary-button"
            disabled={busyAction === "totp-setup"}
            onClick={handleTotpSetup}
            type="button"
          >
            {managerUi.totpSetup}
          </Button>
        ) : null}

        {!session.user.totpEnabled && totpSetup ? (
          <form className="auth-form" onSubmit={handleTotpConfirm}>
            <p className="auth-inline-copy">{managerUi.totpConfirmHint}</p>
            <label>
              <span>{managerUi.totpSecret}</span>
              <Input readOnly value={totpSetup.secret} />
            </label>
            <label>
              <span>{t.auth.mfaCode}</span>
              <Input
                inputMode="numeric"
                name="code"
                onChange={(event) =>
                  setTotpSetup((current) =>
                    current
                      ? { ...current, code: event.target.value }
                      : current,
                  )
                }
                value={totpSetup.code}
              />
            </label>
            <Button
              variant="primary"
              className="primary-button"
              disabled={busyAction === "totp-confirm"}
              type="submit"
            >
              {managerUi.confirm}
            </Button>
          </form>
        ) : null}

        {session.user.totpEnabled ? (
          <form className="auth-form" onSubmit={handleTotpDisable}>
            <p className="auth-inline-copy">{managerUi.totpDisableHint}</p>
            <label>
              <span>{t.auth.password}</span>
              <Input
                name="password"
                onChange={(event) =>
                  setTotpSetup((current) => ({
                    secret: current?.secret ?? "",
                    otpauthUrl: current?.otpauthUrl ?? "",
                    code: current?.code ?? "",
                    password: event.target.value,
                  }))
                }
                type="password"
                value={totpSetup?.password ?? ""}
              />
            </label>
            <label>
              <span>{t.auth.mfaCode}</span>
              <Input
                inputMode="numeric"
                name="code"
                onChange={(event) =>
                  setTotpSetup((current) => ({
                    secret: current?.secret ?? "",
                    otpauthUrl: current?.otpauthUrl ?? "",
                    password: current?.password ?? "",
                    code: event.target.value,
                  }))
                }
                value={totpSetup?.code ?? ""}
              />
            </label>
            <Button
              variant="secondary"
              className="secondary-button"
              disabled={busyAction === "totp-disable"}
              type="submit"
            >
              {managerUi.totpDisable}
            </Button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
