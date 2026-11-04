import { useState } from "react";
import { useWorkspace } from "../../app/WorkspaceContext";
import { PageBoundary } from "../../app/PageBoundary";
import {
  managerMainNav,
  managerExtraNavGroups,
  managerMobileNav,
} from "../../shared/navigation";
import { NavigationIcon } from "./NavigationIcon";
import { Button, IconButton } from "../../ui";
import { WorkspaceHeaderActionHost } from "../../ui/WorkspaceHeaderActions";
import { DocumentPanel } from "../leases/DocumentPanel";
import { ManagerScreen } from "./ManagerScreen";
export function ManagerShell() {
  const [mobileActionTarget, setMobileActionTarget] =
    useState<HTMLDivElement | null>(null);
  const {
    productBrand,
    mobileMenuButton,
    mobileNavOpen,
    setMobileNavOpen,
    activeManagerNav,
    managerScreen,
    setManagerScreen,
    managerUi,
    openTicketCount,
    chatThreads,
    overview,
    session,
    t,
    handleLogout,
    error,
    notice,
  } = useWorkspace();
  const mobileTitleInBar = [
    "dashboard",
    "tickets",
    "objects",
    "units",
    "tenants",
    "leases",
    "billing",
    "operations",
    "notifications",
    "staff",
    "import",
    "profile",
  ].includes(managerScreen);
  const initials = session.user.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("ru-RU");
  const navItem = (
    screen:
      | (typeof managerMainNav)[number]
      | (typeof managerExtraNavGroups)[number]["screens"][number],
  ) => {
    const count =
      screen === "tickets"
        ? openTicketCount
        : screen === "notifications"
          ? overview.notifications.filter((item) => item.unread).length
          : screen === "chat"
            ? chatThreads.reduce(
                (total, thread) => total + thread.unreadCount,
                0,
              )
            : 0;
    return (
      <Button
        variant="plain"
        type="button"
        key={screen}
        className={`mvp-nav-button ${activeManagerNav === screen ? "mvp-nav-button--active" : ""}`}
        aria-current={activeManagerNav === screen ? "page" : undefined}
        onClick={() => {
          setManagerScreen(screen);
          setMobileNavOpen(false);
        }}
      >
        <NavigationIcon name={screen} />
        <span className="mvp-nav-button__label">{managerUi.nav[screen]}</span>
        {count > 0 && <small>{count}</small>}
      </Button>
    );
  };
  return (
    <WorkspaceHeaderActionHost.Provider value={mobileActionTarget}>
      <main className="mvp-shell">
        <header className="mobile-app-bar">
          <h1>{managerUi.nav[activeManagerNav]}</h1>
          <div
            className="mobile-app-bar__actions"
            ref={setMobileActionTarget}
            inert={mobileNavOpen || undefined}
          />
          <IconButton
            label={mobileNavOpen ? "Закрыть меню" : "Меню"}
            ref={mobileMenuButton}
            className="mobile-menu-button"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            <NavigationIcon name={mobileNavOpen ? "close" : "menu"} />
          </IconButton>
        </header>
        {mobileNavOpen && (
          <Button
            variant="plain"
            type="button"
            className="mobile-nav-scrim"
            aria-label="Закрыть меню"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside
          id="workspace-navigation"
          className={`mvp-sidebar ${mobileNavOpen ? "mobile-nav-open" : ""}`}
        >
          <div className="mvp-brand">
            <span className="mvp-brand__mark" aria-hidden="true">
              <NavigationIcon name="objects" />
            </span>
            <strong>{productBrand.name}</strong>
          </div>

          <nav
            aria-label="Разделы приложения"
            className="workspace-navigation-groups"
          >
            <div className="mvp-nav-group" aria-label="Основные разделы">
              {managerMainNav.map(navItem)}
            </div>
            <div className="workspace-extra-nav">
              <div
                id="workspace-extra-groups"
                className="workspace-extra-groups"
              >
                {managerExtraNavGroups.map((group) => (
                  <div className="mvp-nav-group" key={group.label}>
                    <h2 className="navigation-group-label">{group.label}</h2>
                    {group.screens.map(navItem)}
                  </div>
                ))}
              </div>
            </div>
          </nav>

          <div className="mvp-user">
            <span className="mvp-user__avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="mvp-user__identity">
              <strong>{session.user.fullName}</strong>
              <small>
                {t.roles[session.user.role]} ·{" "}
                {session.user.role === "admin"
                  ? "Все объекты"
                  : (overview.properties.find(
                      (p) => p.id === session.user.propertyId,
                    )?.name ?? "Объект не назначен")}
              </small>
            </div>
            <IconButton
              label="Выйти"
              className="sidebar-logout"
              onClick={handleLogout}
            >
              <NavigationIcon name="logout" />
            </IconButton>
          </div>
        </aside>

        <section
          className="mvp-main"
          data-workspace-screen={managerScreen}
          data-mobile-title-in-bar={mobileTitleInBar || undefined}
          inert={mobileNavOpen || undefined}
        >
          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="banner banner--notice" role="status">
              {notice}
            </div>
          ) : null}
          {<DocumentPanel />}

          <PageBoundary>
            <ManagerScreen />
          </PageBoundary>
        </section>
        <nav
          className="mobile-primary-nav"
          aria-label="Быстрые переходы"
          inert={mobileNavOpen || undefined}
        >
          {managerMobileNav.map((screen) => (
            <Button
              variant="plain"
              type="button"
              key={screen}
              aria-current={activeManagerNav === screen ? "page" : undefined}
              onClick={() => {
                setManagerScreen(screen);
                setMobileNavOpen(false);
              }}
            >
              <NavigationIcon name={screen} />
              <span>{managerUi.nav[screen]}</span>
            </Button>
          ))}
        </nav>
      </main>
    </WorkspaceHeaderActionHost.Provider>
  );
}
