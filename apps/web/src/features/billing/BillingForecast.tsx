import { useWorkspace } from "../../app/WorkspaceContext";
import { formatCompactMoney } from "../../shared/format";
import { currency } from "../operations/shared";
export function BillingForecast() {
  const { overview, locale } = useWorkspace();
  return (
    <div className="billing-forecast-view">
      <dl className="billing-summary">
        <div>
          <dt>Доля операционных расходов</dt>
          <dd>{overview.finance.opexRatio}%</dd>
        </div>
        <div>
          <dt>Чистый операционный доход</dt>
          <dd>{formatCompactMoney(overview.finance.noi, locale)}</dd>
        </div>
        <div>
          <dt>Плановый остаток за 3 месяца</dt>
          <dd>
            {formatCompactMoney(overview.finance.forecastQuarter, locale)}
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
                <dd>{currency(month.invoiceAmount)}</dd>
              </div>
              <div>
                <dt>Остальные договоры</dt>
                <dd>{currency(month.contractAmount)}</dd>
              </div>
              <div>
                <dt>Ожидаемые начисления</dt>
                <dd>{currency(month.billed)}</dd>
              </div>
              <div>
                <dt>Внесённые расходы</dt>
                <dd>− {currency(month.expenses)}</dd>
              </div>
              <div>
                <dt>Расчётный остаток</dt>
                <dd>
                  <strong>{currency(month.forecast)}</strong>
                </dd>
              </div>
              <div>
                <dt>Оплачено по счетам</dt>
                <dd>{currency(month.collected)}</dd>
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
                    <span>{currency(row.amount)}</span>
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
