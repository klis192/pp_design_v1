import { useWorkspace } from "../../app/WorkspaceContext";
import { useRef } from "react";
import { ActionIcon } from "../business/ActionIcon";
import {
  formatDateTime,
  formatFileSize,
  supportedFileHint,
} from "../../shared/format";
import { type Ticket } from "../../shared/types";
import { IconButton, Input } from "../../ui";
export function TicketAttachmentBlock({
  ticket,
  title,
}: {
  ticket: Ticket;
  title?: string;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const {
    locale,
    ticketAttachments,
    busyAction,
    handleTicketAttachmentUpload,
    openTicketAttachment,
    session,
    deleteTicketAttachment,
    t,
  } = useWorkspace();
  return (
    <div className="attachment-block">
      <div className="attachment-head">
        <div>
          <h3>
            {title ??
              (locale === "ru" ? "Фото и файлы заявки" : "Ticket files")}
          </h3>
          <span>
            {ticketAttachments.length} ·{" "}
            {formatFileSize(
              ticketAttachments.reduce(
                (total, item) => total + item.sizeBytes,
                0,
              ),
              locale,
            )}
          </span>
          <small className="attachment-hint">
            {supportedFileHint(locale)} · до 100 МБ на файл
          </small>
        </div>
        <div className="attachment-upload">
          <IconButton
            label={locale === "ru" ? "Прикрепить файл" : "Attach file"}
            disabled={busyAction === `ticket-attachment-upload-${ticket.id}`}
            onClick={() => uploadInput.current?.click()}
          >
            <ActionIcon name="upload" />
          </IconButton>
          <Input
            hidden
            ref={uploadInput}
            className="ticket-hidden-file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            disabled={busyAction === `ticket-attachment-upload-${ticket.id}`}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void handleTicketAttachmentUpload(ticket.id, file);
            }}
            type="file"
          />
        </div>
      </div>
      {ticketAttachments.length > 0 ? (
        <div className="attachment-grid">
          {ticketAttachments.map((item) => (
            <article
              className={`attachment-card attachment-card--${item.mediaType}`}
              key={item.id}
            >
              <IconButton
                label={`${locale === "ru" ? "Открыть файл" : "Open file"} ${item.fileName}`}
                className="attachment-preview"
                onClick={() => void openTicketAttachment(ticket.id, item)}
                type="button"
              >
                <ActionIcon name="document" />
              </IconButton>
              <div>
                <strong>{item.fileName}</strong>
                <small>
                  {formatFileSize(item.sizeBytes, locale)} ·{" "}
                  {formatDateTime(item.createdAt, locale)}
                </small>
                <small>{item.uploadedByName ?? "—"}</small>
              </div>
              {session &&
              (["admin", "manager"].includes(session.user.role) ||
                item.uploadedBy === session.user.id) ? (
                <IconButton
                  label={`${t.actions.delete}: ${item.fileName}`}
                  className="text-button text-button--danger"
                  onClick={() =>
                    void deleteTicketAttachment(ticket.id, item.id)
                  }
                  type="button"
                >
                  <ActionIcon name="delete" />
                </IconButton>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {locale === "ru"
            ? "Файлы к заявке еще не прикреплены."
            : "No ticket files yet."}
        </div>
      )}
    </div>
  );
}
