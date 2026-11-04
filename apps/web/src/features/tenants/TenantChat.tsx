import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWorkspace } from "../../app/WorkspaceContext";
import {
  formatChannel,
  formatDateTime,
  getChatRoleLabel,
  getTicketStatusLabel,
} from "../../shared/format";
import { Button, IconButton, Textarea } from "../../ui";
import { ActionIcon } from "../business/ActionIcon";
import "./personal-mobile.css";
// Unsaved text stays in this tab and belongs to one session and conversation.
const conversationDrafts = new Map<string, string>();
type DraftScope = { token: string; key: string; content: string };
const sessionDraftOwners = new Map<string, DraftScope>();
const pendingConversations = new Map<string, string>();
const draftKey = (token: string, ticketId: string) =>
  JSON.stringify([token, ticketId]);
const keepDraft = (key: string, content: string) => {
  if (content) conversationDrafts.set(key, content);
  else conversationDrafts.delete(key);
};
const rememberDraftScope = (scope: DraftScope) => {
  if (scope.key) keepDraft(scope.key, scope.content);
  sessionDraftOwners.set(scope.token, { ...scope });
};
export function TenantChat() {
  const [threadOpen, setThreadOpen] = useState(false);
  const threadTitle = useRef<HTMLHeadingElement>(null);
  const listTitle = useRef<HTMLHeadingElement>(null);
  const messageBody = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const previousThread = useRef("");
  const {
    locale,
    selectedChatTickets,
    selectedChatTargetTicket,
    setSelectedChatTicketId,
    t,
    chatMessages,
    chatBusy,
    managerUi,
    isTenant,
    handleChatSubmit,
    handleFieldChange,
    setChatDraft,
    chatDraft,
    busyAction,
    session,
  } = useWorkspace();
  const currentKey = selectedChatTargetTicket
    ? draftKey(session.token, selectedChatTargetTicket.id)
    : "";
  const draftScope = useRef<DraftScope>(
    sessionDraftOwners.get(session.token) ?? {
      token: session.token,
      key: "",
      content: "",
    },
  );
  const [readyKey, setReadyKey] = useState(draftScope.current.key);
  const draftReady =
    Boolean(currentKey) &&
    readyKey === currentKey &&
    draftScope.current.key === currentKey;
  useLayoutEffect(() => {
    if (draftScope.current.key !== currentKey) {
      rememberDraftScope(draftScope.current);
      const content = conversationDrafts.get(currentKey) ?? "";
      draftScope.current = { token: session.token, key: currentKey, content };
      rememberDraftScope(draftScope.current);
      setChatDraft((current) => ({ ...current, content }));
      setReadyKey(currentKey);
      return;
    }
    const pendingKey = pendingConversations.get(session.token);
    if (pendingKey && pendingKey !== currentKey) {
      // A response for the previous conversation must not clear this draft.
      if (chatDraft.content !== draftScope.current.content)
        setChatDraft((current) => ({
          ...current,
          content: draftScope.current.content,
        }));
      if (busyAction !== "chat-submit")
        pendingConversations.delete(session.token);
      return;
    }
    if (pendingKey && busyAction !== "chat-submit")
      pendingConversations.delete(session.token);
    draftScope.current.content = chatDraft.content;
    rememberDraftScope(draftScope.current);
  }, [currentKey, session.token, chatDraft.content, busyAction, setChatDraft]);
  useEffect(
    () => () => {
      rememberDraftScope(draftScope.current);
    },
    [],
  );
  useEffect(() => {
    const body = messageBody.current;
    if (!body) return;
    const changed = previousThread.current !== selectedChatTargetTicket?.id;
    if (changed || followMessages.current) body.scrollTop = body.scrollHeight;
    previousThread.current = selectedChatTargetTicket?.id ?? "";
  }, [selectedChatTargetTicket?.id, chatMessages.length, threadOpen]);
  return (
    <section
      className="personal-chat"
      data-chat-view={threadOpen ? "thread" : "list"}
    >
      <article className="personal-chat-list">
        <div className="surface-head">
          <div>
            <h2 ref={listTitle} tabIndex={-1}>
              {locale === "ru" ? "Диалоги по заявкам" : "Ticket chats"}
            </h2>
          </div>
        </div>
        <div className="stack-list">
          {selectedChatTickets.length > 0 ? (
            selectedChatTickets.map((ticket) => (
              <Button
                variant="plain"
                disabled={busyAction === "chat-submit"}
                className={
                  selectedChatTargetTicket?.id === ticket.id
                    ? "list-row table-row-active"
                    : "list-row"
                }
                key={ticket.id}
                onClick={() => {
                  setSelectedChatTicketId(ticket.id);
                  setThreadOpen(true);
                  requestAnimationFrame(() => threadTitle.current?.focus());
                }}
                type="button"
              >
                <div>
                  <strong>{ticket.title}</strong>
                  <p>
                    {ticket.number} · {ticket.unitNumber ?? "—"} ·{" "}
                    {ticket.propertyName ?? "—"}
                  </p>
                </div>
                <div className="list-aside">
                  <span className={`status-pill status-pill--${ticket.status}`}>
                    {getTicketStatusLabel(ticket.status, locale)}
                  </span>
                </div>
              </Button>
            ))
          ) : (
            <div className="empty-state">{t.hints.ticketEmpty}</div>
          )}
        </div>
      </article>

      <article className="personal-chat-thread">
        <div className="personal-chat-heading">
          <IconButton
            label="К списку диалогов"
            className="personal-chat-back"
            disabled={busyAction === "chat-submit"}
            onClick={() => {
              setThreadOpen(false);
              requestAnimationFrame(() => listTitle.current?.focus());
            }}
          >
            <ActionIcon name="back" />
          </IconButton>
          <div>
            <div className="record-number">
              {selectedChatTargetTicket?.number ?? t.nav.chat}
            </div>
            <h2 ref={threadTitle} tabIndex={-1}>
              {selectedChatTargetTicket?.title ?? t.nav.chat}
            </h2>
            <small>
              {selectedChatTargetTicket?.unitNumber ?? "—"} ·{" "}
              {selectedChatTargetTicket?.propertyName ?? "—"}
            </small>
          </div>
        </div>

        <div
          className="mvp-chat-body"
          ref={messageBody}
          tabIndex={0}
          aria-label="Сообщения диалога"
          onScroll={(event) => {
            const body = event.currentTarget;
            followMessages.current =
              body.scrollHeight - body.scrollTop - body.clientHeight < 64;
          }}
        >
          {(() => {
            const visibleMessages = selectedChatTargetTicket
              ? chatMessages.filter(
                  (message) => message.ticketId === selectedChatTargetTicket.id,
                )
              : chatMessages;

            if (chatBusy && visibleMessages.length === 0) {
              return <div className="empty-state">{t.loading}</div>;
            }

            if (visibleMessages.length === 0) {
              return <div className="empty-state">{managerUi.emptyChat}</div>;
            }

            return visibleMessages.map((message) => (
              <div
                className={
                  message.direction === "incoming"
                    ? "mvp-chat-message"
                    : "mvp-chat-message mvp-chat-message--outgoing"
                }
                key={message.id}
              >
                <strong>
                  <span>
                    {getChatRoleLabel(message.authorRole, locale, isTenant)}
                  </span>
                  <span
                    className={`channel-pill channel-pill--${message.sourceChannel}`}
                  >
                    {formatChannel(message.sourceChannel, locale)}
                  </span>
                </strong>
                <p>{message.content}</p>
                <small>
                  {message.ticketNumber} ·{" "}
                  {formatDateTime(message.createdAt, locale)}
                </small>
              </div>
            ));
          })()}
        </div>

        <form
          className="mvp-chat-form"
          onSubmit={async (event) => {
            if (
              !draftReady ||
              draftScope.current.key !== currentKey ||
              !chatDraft.content.trim()
            ) {
              event.preventDefault();
              return;
            }
            const submittedKey = currentKey;
            const submittedToken = session.token;
            pendingConversations.set(submittedToken, submittedKey);
            const sent = await handleChatSubmit(event);
            if (sent) {
              conversationDrafts.delete(submittedKey);
              const owner = sessionDraftOwners.get(submittedToken);
              if (owner?.key === submittedKey)
                sessionDraftOwners.set(submittedToken, {
                  ...owner,
                  content: "",
                });
              if (draftScope.current.key === submittedKey)
                draftScope.current.content = "";
            }
          }}
        >
          <Textarea
            aria-label="Сообщение"
            disabled={!draftReady || busyAction === "chat-submit"}
            name="content"
            onChange={handleFieldChange(setChatDraft)}
            placeholder={locale === "ru" ? "Написать сообщение" : "Write a message"}
            rows={2}
            value={draftReady ? chatDraft.content : ""}
          />
          <IconButton
            label={managerUi.send}
            variant="primary"
            busy={busyAction === "chat-submit"}
            disabled={
              !draftReady ||
              !selectedChatTargetTicket ||
              !chatDraft.content.trim()
            }
            type="submit"
          >
            <ActionIcon name="send" />
          </IconButton>
        </form>
      </article>
    </section>
  );
}
