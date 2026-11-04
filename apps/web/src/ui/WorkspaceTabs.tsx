import { useId, useRef } from "react";
import "./workspace.css";
export type WorkspaceTab = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
};
export function WorkspaceTabs({
  label,
  items,
  value,
  onChange,
  idPrefix,
  className = "",
}: {
  label: string;
  items: readonly WorkspaceTab[];
  value: string;
  onChange: (id: string) => void;
  idPrefix?: string;
  className?: string;
}) {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const enabled = items.filter((item) => !item.disabled);
  const current = enabled.some((item) => item.id === value)
    ? value
    : enabled[0]?.id;
  return (
    <div
      className={`ui-workspace-tabs ${className}`}
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.id}
          ref={(node) => {
            if (node) buttons.current.set(item.id, node);
            else buttons.current.delete(item.id);
          }}
          type="button"
          role="tab"
          id={`${prefix}-tab-${item.id}`}
          aria-controls={idPrefix ? `${prefix}-panel-${item.id}` : undefined}
          aria-selected={item.id === current}
          disabled={item.disabled}
          tabIndex={item.id === current ? 0 : -1}
          className="ui-workspace-tab"
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            const index = enabled.findIndex(
              (candidate) => candidate.id === item.id,
            );
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? enabled.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % enabled.length
                    : event.key === "ArrowLeft"
                      ? (index + enabled.length - 1) % enabled.length
                      : -1;
            if (nextIndex < 0) return;
            event.preventDefault();
            const next = enabled[nextIndex];
            onChange(next.id);
            buttons.current.get(next.id)?.focus({ preventScroll: true });
          }}
        >
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className="ui-workspace-tab__count">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
