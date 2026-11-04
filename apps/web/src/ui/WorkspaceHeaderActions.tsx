import {
  createContext,
  useContext,
  useSyncExternalStore,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

export const WorkspaceHeaderActionHost = createContext<HTMLElement | null>(
  null,
);
const media = "(max-width: 1080px)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(media);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isCompact() {
  return window.matchMedia(media).matches;
}

/** Keep page actions with the single visible page title at every breakpoint. */
export function WorkspaceHeaderActions({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const host = useContext(WorkspaceHeaderActionHost);
  const compact = useSyncExternalStore(subscribe, isCompact, () => false);
  const actions = (
    <div {...props} className={`mvp-actions ${className}`}>
      {children}
    </div>
  );
  return compact && host ? createPortal(actions, host) : actions;
}
