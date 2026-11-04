import { useId, useRef, type ReactNode } from "react";
import { IconButton, Input } from "../../ui";
import { ActionIcon } from "./ActionIcon";

/** One working row for the search, common filters and secondary actions. */
export function FilterBar({
  children,
  actions,
  summary,
  className = "",
}: {
  children: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`filter-bar ${className}`}>
      <div className="filter-bar-main">
        <div className="filter-bar-controls">{children}</div>
        {actions && <div className="filter-bar-actions">{actions}</div>}
      </div>
      {summary && <div className="filter-bar-summary">{summary}</div>}
    </div>
  );
}

export function FilterSearch({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder = "Поиск",
  maxLength = 200,
  disabled = false,
  className = "",
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const accessibleLabel = ariaLabel ?? label;
  return (
    <div className={`filter-search ${className}`}>
      <label htmlFor={id}>Поиск</label>
      <div className="filter-search-control">
        <span className="filter-search-icon" aria-hidden="true">
          <ActionIcon name="search" />
        </span>
        <Input
          ref={input}
          id={id}
          aria-label={accessibleLabel}
          type="search"
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <IconButton
            label={`Очистить поиск: ${accessibleLabel.replace(/^Поиск:\s*/, "")}`}
            disabled={disabled}
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <ActionIcon name="close" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

export function ActiveFilters({
  items,
  onReset,
  label = "Сбросить фильтры",
}: {
  items: { key: string; label: string; onClear?: () => void }[];
  onReset?: () => void;
  label?: string;
}) {
  if (!items.length && !onReset) return null;
  return (
    <div className="active-filters" aria-label="Активные фильтры">
      {items.map((item) =>
        item.onClear ? (
          <button
            className="active-filter"
            key={item.key}
            type="button"
            title={`Убрать фильтр: ${item.label}`}
            aria-label={`Убрать фильтр: ${item.label}`}
            onClick={item.onClear}
          >
            <span>{item.label}</span>
            <span aria-hidden="true">
              <ActionIcon name="close" />
            </span>
          </button>
        ) : (
          <span className="active-filter" key={item.key}>
            {item.label}
          </span>
        ),
      )}
      {onReset && (
        <IconButton label={label} onClick={onReset}>
          <ActionIcon name="refresh" />
        </IconButton>
      )}
    </div>
  );
}
