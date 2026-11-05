import { type CSSProperties, type ReactNode } from "react";
import { daysUntil } from "../../shared/format";
import "./lease-lines.css";

type LineLease = {
  id: string;
  contractNumber: string;
  stage: string;
  startDate: string;
  endDate: string;
  indexationPct: number;
  tenantName: string | null;
  unitNumber: string | null;
  propertyName: string | null;
};

const DAY = 86400000;
const EXPIRING_DAYS = 90;
const PREPARING = new Set(["draft", "formed", "sent"]);

const shortDate = (time: number) => new Date(time).toLocaleDateString("ru-RU");
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/**
 * Договоры как линии на общей шкале времени.
 * Пройденный срок — сплошная линия, оставшийся — бледная, «сегодня» —
 * графитовая станция; годовщины индексации — станции на линии;
 * пролонгация ответвляется от конца, расторжение обрывает линию.
 */
export function LeaseLines<T extends LineLease>({
  leases,
  stageLabels,
  actions,
}: {
  leases: T[];
  stageLabels: Record<string, string>;
  actions: (lease: T) => ReactNode;
}) {
  const now = Date.now();
  const parsed = leases
    .map((lease) => ({
      lease,
      start: Date.parse(lease.startDate),
      end: Date.parse(lease.endDate),
    }))
    .filter((item) => !Number.isNaN(item.start) && !Number.isNaN(item.end));

  if (!parsed.length)
    return (
      <div className="empty-state">
        Договоров по этим условиям нет. Измените стадию или срок окончания.
      </div>
    );

  // Окно шкалы: от года назад (или раньше начала) до последнего окончания,
  // но не дальше трёх лет вперёд.
  const from = Math.max(
    Math.min(...parsed.map((item) => item.start), now - 365 * DAY),
    now - 3 * 365 * DAY,
  );
  const to = Math.min(
    Math.max(...parsed.map((item) => item.end), now + 365 * DAY) + 120 * DAY,
    now + 3 * 365 * DAY,
  );
  const span = to - from;
  const at = (time: number) =>
    Math.max(0, Math.min(100, ((time - from) / span) * 100));

  const years: number[] = [];
  for (
    let year = new Date(from).getFullYear() + 1;
    year <= new Date(to).getFullYear();
    year += 1
  )
    years.push(new Date(year, 0, 1).getTime());

  const rank = (stage: string) =>
    stage === "terminated" ? 2 : PREPARING.has(stage) ? 1 : 0;
  const rows = [...parsed].sort(
    (a, b) => rank(a.lease.stage) - rank(b.lease.stage) || a.end - b.end,
  );

  return (
    <div
      className="lease-lines"
      style={{ "--today": `${at(now)}%` } as CSSProperties}
    >
      <div className="lease-lines__axis" aria-hidden="true">
        <span className="lease-lines__axis-spacer" />
        <span className="lease-lines__scale">
          {years
            .filter((year) => Math.abs(at(year) - at(now)) > 10)
            .map((year) => (
              <span
                key={year}
                className="lease-lines__year"
                style={{ left: `${at(year)}%` }}
              >
                {new Date(year).getFullYear()}
              </span>
            ))}
          <span className="lease-lines__today-label">Сегодня</span>
        </span>
        <span />
      </div>

      <ol className="lease-lines__list">
        {rows.map(({ lease, start, end }) => {
          const preparing = PREPARING.has(lease.stage);
          const terminated = lease.stage === "terminated";
          const prolonged = lease.stage === "prolongation";
          const left = daysUntil(lease.endDate) ?? 0;
          const expired = !terminated && left < 0;
          const expiring = !terminated && !expired && left <= EXPIRING_DAYS;
          const inForce = !preparing && !terminated;
          const indexations: number[] = [];
          if (lease.indexationPct > 0)
            for (let date = new Date(start), n = 1; n < 10; n += 1) {
              const next = new Date(date);
              next.setFullYear(date.getFullYear() + n);
              if (next.getTime() >= end) break;
              indexations.push(next.getTime());
            }
          const state = terminated
            ? "terminated"
            : preparing
              ? "preparing"
              : expired
                ? "expired"
                : expiring
                  ? "expiring"
                  : "active";
          return (
            <li key={lease.id} className="lease-line" data-state={state}>
              <div className="lease-line__who">
                <strong>{lease.tenantName ?? "Арендатор не указан"}</strong>
                <small>
                  {lease.contractNumber} ·{" "}
                  {[lease.propertyName, lease.unitNumber]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>

              <div
                className="lease-line__track"
                role="img"
                aria-label={`Договор ${lease.contractNumber}: ${stageLabels[lease.stage] ?? lease.stage}, с ${shortDate(start)} по ${shortDate(end)}`}
              >
                <span className="lease-line__today" aria-hidden="true" />
                <span
                  className="lease-line__rail"
                  style={{
                    left: `${at(start)}%`,
                    width: `${at(end) - at(start)}%`,
                  }}
                />
                {inForce && now > start && (
                  <span
                    className="lease-line__done"
                    style={{
                      left: `${at(start)}%`,
                      width: `${at(Math.min(now, end)) - at(start)}%`,
                    }}
                  />
                )}
                {prolonged && (
                  <span
                    className="lease-line__branch"
                    style={{
                      left: `${at(end)}%`,
                      width: `${Math.max(at(end + 365 * DAY) - at(end), 4)}%`,
                    }}
                    title="Пролонгация: договор продлевается после окончания срока"
                  >
                    <span>пролонгация</span>
                  </span>
                )}
                <span
                  className="lease-line__stop lease-line__stop--start"
                  style={{ left: `${at(start)}%` }}
                  title={`Начало: ${shortDate(start)}`}
                />
                {indexations.map((time) => (
                  <span
                    key={time}
                    className="lease-line__stop lease-line__stop--index"
                    style={{ left: `${at(time)}%` }}
                    title={`Индексация +${lease.indexationPct} % с ${shortDate(time)}`}
                  />
                ))}
                <span
                  className="lease-line__stop lease-line__stop--end"
                  style={{ left: `${at(end)}%` }}
                  title={`Окончание: ${shortDate(end)}`}
                />
                {inForce && now > start && now < end && (
                  <span
                    className="lease-line__stop lease-line__stop--now"
                    style={{ left: `${at(now)}%` }}
                  />
                )}
              </div>

              <div className="lease-line__end">
                <span>{shortDate(end)}</span>
                <small>
                  {terminated ? (
                    (stageLabels.terminated ?? "Завершён")
                  ) : preparing ? (
                    (stageLabels[lease.stage] ?? lease.stage)
                  ) : expired ? (
                    "срок истёк"
                  ) : (
                    <>
                      {prolonged && (
                        <span className="lease-line__prolong-note">
                          пролонгация ·{" "}
                        </span>
                      )}
                      через {left} {plural(left, "день", "дня", "дней")}
                    </>
                  )}
                </small>
              </div>
              <div className="lease-line__actions">{actions(lease)}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
