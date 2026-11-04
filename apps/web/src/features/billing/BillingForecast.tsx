import { useWorkspace } from "../../app/WorkspaceContext";
import { formatBillingMoney } from "./format";
export function BillingForecast() {
  const { overview, locale } = useWorkspace();
  return (
    <div className="billing-forecast-view">
      <dl className="billing-summary billing-summary--three">
        <div>
          <dt>Доля операционных расходов</dt>
          <dd>{overview.finance.opexRatio}%</dd>
        </div>
        <div>
          <dt>Чистый операционный доход</dt>
          <dd>{formatBillingMoney(overview.finance.noi, locale)}</dd>
        </div>
        <div>
          <dt>Плановый остаток за 3 месяца</dt>
          <dd>
            {formatBillingMoney(overview.finance.forecastQuarter, locale)}
          </dd>
        </div>
      </dl>
      <div className="billing-forecast-months">
        {overview.finance.series.map((month) => (
          <section key={month.id} className="billing-forecast-month">
            <h3>{month.label}</h3>
            <dl className="billing-month-totals">
              <div>
                <dt>Выставленные счета</dt>
                <dd>{formatBillingMoney(month.invoiceAmount, locale)}</dd>
              </div>
              <div>
                <dt>Остальные договоры</dt>
                <dd>{formatBillingMoney(month.contractAmount, locale)}</dd>
              </div>
              <div>
                <dt>Ожидаемые начисления</dt>
                <dd>{formatBillingMoney(month.billed, locale)}</dd>
              </div>
              <div>
                <dt>Внесённые расходы</dt>
                <dd>
                  {formatBillingMoney(
                    month.expenses ? -month.expenses : 0,
                    locale,
                  )}
                </dd>
              </div>
              <div className="billing-month-result">
                <dt>Расчётный остаток</dt>
                <dd>
                  <strong>{formatBillingMoney(month.forecast, locale)}</strong>
                </dd>
              </div>
              <div>
                <dt>Оплачено по счетам</dt>
                <dd>{formatBillingMoney(month.collected, locale)}</dd>
              </div>
            </dl>
            <h4>Начисления по договорам</h4>
            {month.details.length ? (
              <ul className="billing-forecast-details">
                {month.details.map((row) => (
                  <li key={row.leaseId}>
                    <div>
                      <strong>{row.contractNumber}</strong>
                      <span>Помещение {row.unitNumber}</span>
                      <small>
                        {row.basis === "invoice"
                          ? "По выставленному счёту"
                          : `По ставке договора за ${row.days} дн.`}
                      </small>
                    </div>
                    <span>{formatBillingMoney(row.amount, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ui-empty">Нет действующих договоров и счетов.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
