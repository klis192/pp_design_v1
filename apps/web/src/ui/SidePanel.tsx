import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "./index";
import "./workspace.css";
export function SidePanel({
  title,
  description,
  children,
  footer,
  onClose,
  open = true,
  busy = false,
  dirty = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open?: boolean;
  busy?: boolean;
  dirty?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLElement>(null),
    overlay = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose),
    busyRef = useRef(busy),
    dirtyRef = useRef(dirty),
    confirmRef = useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  closeRef.current = onClose;
  busyRef.current = busy;
  dirtyRef.current = dirty;
  confirmRef.current = confirmClose;
  const requestClose = () => {
    if (busyRef.current) return;
    if (dirtyRef.current) setConfirmClose(true);
    else closeRef.current();
  };
  useEffect(() => {
    if (!open) return;
    setConfirmClose(false);
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow,
      previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const siblings = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          element !== overlay.current &&
          !element.contains(overlay.current),
      )
      .map((element) => ({ element, inert: element.inert }));
    for (const { element } of siblings) element.inert = true;
    panel.current
      ?.querySelector<HTMLElement>("[data-panel-title]")
      ?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      const layers = document.querySelectorAll("[data-ui-side-panel]");
      if (layers[layers.length - 1] !== overlay.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (confirmRef.current) setConfirmClose(false);
        else requestClose();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.closest("[hidden],[inert]"),
      );
      const first = items[0],
        last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement?.hasAttribute("data-panel-title"))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      for (const { element, inert } of siblings) element.inert = inert;
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div
      className="ui-side-panel-layer"
      ref={overlay}
      data-ui-side-panel=""
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        className="ui-side-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
      >
        <header className="ui-side-panel__header">
          <div>
            <h2 id={`${id}-title`} tabIndex={-1} data-panel-title="">
              {title}
            </h2>
            {description && <p id={`${id}-description`}>{description}</p>}
          </div>
          <IconButton
            label="Закрыть панель"
            disabled={busy}
            onClick={requestClose}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </header>
        {confirmClose && (
          <div className="ui-side-panel__confirm" role="alert">
            <p>Закрыть без сохранения изменений?</p>
            <div className="ui-actions">
              <Button variant="danger" onClick={() => closeRef.current()}>
                Закрыть без сохранения
              </Button>
              <Button onClick={() => setConfirmClose(false)}>
                Продолжить редактирование
              </Button>
            </div>
          </div>
        )}
        <div className="ui-side-panel__body">{children}</div>
        {footer && <footer className="ui-side-panel__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
