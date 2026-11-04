import { ActionIcon } from "../business/ActionIcon";
import { useWorkspace } from "../../app/WorkspaceContext";
import { Button, IconButton } from "../../ui";
import { TicketCreateFields } from "./TicketCreateFields";
import "./workspace.css";
export function ManagerTicketCreate() {
  const { setManagerScreen, managerUi, handleCreateTicket, t, busyAction } =
    useWorkspace();
  return (
    <section className="mvp-page">
      <div className="mvp-detail-head">
        <IconButton
          label={managerUi.back}
          variant="plain"
          className="mvp-back"
          onClick={() => setManagerScreen("tickets")}
          type="button"
        >
          <ActionIcon name="back" />
        </IconButton>
        <div>
          <h2>{managerUi.titles.ticketCreate}</h2>
        </div>
      </div>

      <article className="mvp-card">
        <form className="ticket-create-form" onSubmit={handleCreateTicket}>
          <TicketCreateFields />
          <div className="ui-actions ticket-create-actions">
            <Button
              variant="primary"
              className="primary-button"
              disabled={busyAction === "ticket-create"}
              type="submit"
            >
              {t.actions.create}
            </Button>
          </div>
        </form>
      </article>
    </section>
  );
}
