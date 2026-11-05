import { type CSSProperties } from "react";
import {
  isOpenTicket,
  slaState,
} from "../../../../../packages/contracts/src/domain";
import { daysUntil, formatArea } from "../../shared/format";
import type { Locale } from "../../projectData";
import "./unit-board.css";

type BoardUnit = {
  id: string;
  propertyName: string | null;
  building: string | null;
  floor: number | null;
  number: string;
  area: number;
  type: string | null;
  status: string | null;
  tenantName: string | null;
  leaseEndDate: string | null;
};
type BoardTicket = {
  unitId?: string | null;
  status: string;
  slaDueAt?: string | null;
};

const EXPIRING_DAYS = 90;

/**
 * Шахматка: все помещения объекта рядами по корпусу и этажу.
 * Ширина секции растёт с площадью, заливка — статус аренды,
 * станция в углу — открытые заявки по помещению.
 */
export function UnitBoard({
  units,
  tickets,
  locale,
  typeLabels,
  statusLabels,
  onUnit,
}: {
  units: BoardUnit[];
  tickets: BoardTicket[];
  locale: Locale;
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
  onUnit: (id: string) => void;
}) {
  const openByUnit = new Map<string, { count: number; overdue: number }>();
  for (const ticket of tickets) {
    if (!ticket.unitId || !isOpenTicket(ticket.status)) continue;
    const entry = openByUnit.get(ticket.unitId) ?? { count: 0, overdue: 0 };
    entry.count += 1;
    if (slaState(ticket).state === "overdue") entry.overdue += 1;
    openByUnit.set(ticket.unitId, entry);
  }

  const rows = new Map<string, BoardUnit[]>();
  for (const unit of [...units].sort(
    (a, b) =>
      (a.propertyName ?? "").localeCompare(b.propertyName ?? "", "ru") ||
      (a.building || "").localeCompare(b.building || "", "ru") ||
      (a.floor ?? 0) - (b.floor ?? 0) ||
      a.number.localeCompare(b.number, "ru", { numeric: true }),
  )) {
    const key = [
      unit.propertyName ?? "",
      unit.building ? `Корпус ${unit.building}` : "",
      unit.floor != null ? `${unit.floor} этаж` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    rows.set(key, [...(rows.get(key) ?? []), unit]);
  }

  const rowArea = (row: BoardUnit[]) =>
    row.reduce((sum, unit) => sum + Math.max(Number(unit.area) || 0, 1), 0);
  // Масштаб общий для всех рядов: самый большой ряд занимает всю ширину.
  const widest = Math.max(1, ...[...rows.values()].map(rowArea));
  // Поля из учёта могут прийти пустыми: тип, статус, этаж, корпус.
  const statusLabel = (status: string | null) =>
    (status && statusLabels[status]) || status || "Статус не указан";
  const typeLabel = (type: string | null) =>
    ((type && typeLabels[type]) || type || "").toLocaleLowerCase("ru-RU");
  const areaBy = (status: string) =>
    units
      .filter((unit) => unit.status === status)
      .reduce((sum, unit) => sum + Number(unit.area || 0), 0);
  const total = units.reduce((sum, unit) => sum + Number(unit.area || 0), 0);
  const parts = [
    { status: "occupied", area: areaBy("occupied") },
    { status: "vacant", area: areaBy("vacant") },
    { status: "maintenance", area: areaBy("maintenance") },
  ];
  const share = (area: number) =>
    total ? Math.round((area / total) * 1000) / 10 : 0;
  const percent = (value: number) =>
    `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)} %`;

  if (!units.length)
    return (
      <div className="empty-state">
        В объекте пока нет помещений. Добавьте первое помещение кнопкой «+» в
        заголовке.
      </div>
    );

  return (
    <div className="unit-board">
      <div className="unit-board__summary">
        <p className="unit-board__lead">
          Занято <strong>{formatArea(parts[0].area, locale)}</strong> из{" "}
          {formatArea(total, locale)} · {percent(share(parts[0].area))}
        </p>
        <div className="unit-board__split" aria-hidden="true">
          {parts.map((part) =>
            part.area ? (
              <span
                key={part.status}
                data-status={part.status}
                style={{ flexGrow: part.area } as CSSProperties}
              />
            ) : null,
          )}
        </div>
        <ul className="unit-board__legend">
          {parts.map((part) => (
            <li key={part.status} data-status={part.status}>
              {statusLabel(part.status)} <b>{formatArea(part.area, locale)}</b>
            </li>
          ))}
          <li data-kind="tickets">Открытые заявки</li>
        </ul>
      </div>

      {[...rows.entries()].map(([label, rowUnits]) => (
        <section className="unit-board__row" key={label}>
          <h3>{label}</h3>
          <div className="unit-board__bays">
            {rowUnits.map((unit) => {
              const open = openByUnit.get(unit.id);
              const days =
                unit.status === "occupied"
                  ? daysUntil(unit.leaseEndDate)
                  : null;
              const expiring = days !== null && days <= EXPIRING_DAYS;
              return (
                <button
                  key={unit.id}
                  type="button"
                  className="unit-bay"
                  data-status={unit.status ?? "unknown"}
                  style={{
                    flex: `0 1 calc((100% - ${(rowUnits.length - 1) * 6}px) * ${Math.max(Number(unit.area) || 0, 1) / widest})`,
                  }}
                  onClick={() => onUnit(unit.id)}
                  aria-label={`Помещение ${unit.number}, ${formatArea(unit.area, locale)}, ${statusLabel(unit.status)}${unit.tenantName ? `, ${unit.tenantName}` : ""}${open ? `, открытых заявок: ${open.count}` : ""}`}
                >
                  <span className="unit-bay__top">
                    <span className="unit-bay__number">{unit.number}</span>
                    {open && (
                      <span
                        className="unit-bay__tickets"
                        data-overdue={open.overdue > 0 || undefined}
                        title={`Открытых заявок: ${open.count}${open.overdue ? `, просрочено: ${open.overdue}` : ""}`}
                      >
                        {open.count}
                      </span>
                    )}
                  </span>
                  <span className="unit-bay__meta">
                    {[formatArea(unit.area, locale), typeLabel(unit.type)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="unit-bay__who">
                    {unit.status === "occupied"
                      ? (unit.tenantName ?? "Арендатор не указан")
                      : statusLabel(unit.status)}
                  </span>
                  {unit.status === "occupied" && unit.leaseEndDate && (
                    <span
                      className="unit-bay__lease"
                      data-expiring={expiring || undefined}
                    >
                      до{" "}
                      {new Date(unit.leaseEndDate).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
