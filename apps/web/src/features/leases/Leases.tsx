import { useId, useState } from "react";
import { AccountingWorkspace } from "../business/AccountingWorkspace";
import { ReadingsWorkspace } from "../business/ReadingsWorkspace";
import { DocumentRegistry } from "../business/DocumentRegistry";
import { useWorkspace } from "../../app/WorkspaceContext";
import { BotLinkPanel } from "../../MessengerButtons";
import { TenantServices } from "../operations/TenantServices";
import { ResponsiveTable } from "../../ResponsiveTable";
import {
  daysUntil,
  formatCompactMoney,
  formatDate,
  formatDateTime,
  getCollectionBasisLabel,
  supportedFileHint,
} from "../../shared/format";
import { documentCategoryOptions } from "../../shared/navigation";
import { Badge, Button, IconButton, Input, Select } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { SidePanel } from "../../ui/SidePanel";
import { ActionIcon } from "../business/ActionIcon";
import "../tenants/personal-mobile.css";
export function Leases() {
  const [rentalTab, setRentalTab] = useState("accounts");
  const [proofOpen, setProofOpen] = useState(false);
  const proofId = useId();
  const tabId = useId();
  const {
    isTenant,
    operations,
    session,
    t,
    overview,
    loadLeaseDocuments,
    locale,
    handlePaymentProofSubmit,
    handleFieldChange,
    setPaymentProofForm,
    paymentProofForm,
    paymentProofFile,
    setDocumentUploadCategory,
    documentUploadCategory,
    getDocumentCategoryLabel,
    setPaymentProofFile,
    getFileKind,
    busyAction,
    canManagePortfolio,
    ui,
    downloadExport,
    managerUi,
    leaseWatch,
    error,
    notice,
  } = useWorkspace();
  const closeProof = () => {
    setProofOpen(false);
    setPaymentProofForm((current) => ({
      ...current,
      amount: "",
      reference: "",
      paidAt: new Date().toISOString().slice(0, 10),
    }));
    setPaymentProofFile(null);
  };
  const panelStyle = (id: string) =>
    rentalTab === id ? undefined : { display: "none" };
  const endingDays = (lease: (typeof overview.leases)[number]) =>
    ["signed", "active", "prolongation"].includes(lease.stage)
      ? daysUntil(lease.endDate)
      : null;
  const listedLeases = isTenant
    ? [...overview.leases].sort(
        (left, right) =>
          (endingDays(left) ?? Infinity) - (endingDays(right) ?? Infinity) ||
          left.contractNumber.localeCompare(right.contractNumber, "ru"),
      )
    : overview.leases;
  return (
    <section className={isTenant ? "personal-rental" : "section-grid"}>
      {isTenant && (
        <>
          <WorkspaceTabs
            label="Моя аренда"
            idPrefix={tabId}
            items={[
              { id: "accounts", label: "Оплаты" },
              { id: "leases", label: "Договоры" },
              { id: "readings", label: "Показания" },
              { id: "documents", label: "Документы" },
              { id: "services", label: "Услуги" },
              { id: "connection", label: "Связь" },
            ]}
            value={rentalTab}
            onChange={setRentalTab}
          />
          <div
            className="personal-rental-panel"
            role="tabpanel"
            id={`${tabId}-panel-accounts`}
            aria-labelledby={`${tabId}-tab-accounts`}
            style={panelStyle("accounts")}
          >
            <div className="personal-rental-actions">
              <Button
                variant="primary"
                disabled={!overview.leases.length}
                onClick={() => setProofOpen(true)}
              >
                <ActionIcon name="upload" />
                Отправить чек
              </Button>
            </div>
            <AccountingWorkspace />
          </div>
          <div
            className="personal-rental-panel"
            role="tabpanel"
            id={`${tabId}-panel-readings`}
            aria-labelledby={`${tabId}-tab-readings`}
            style={panelStyle("readings")}
          >
            <ReadingsWorkspace />
          </div>
          <div
            className="personal-rental-panel"
            role="tabpanel"
            id={`${tabId}-panel-documents`}
            aria-labelledby={`${tabId}-tab-documents`}
            style={panelStyle("documents")}
          >
            <DocumentRegistry />
          </div>
          <div
            className="personal-rental-panel"
            role="tabpanel"
            id={`${tabId}-panel-services`}
            aria-labelledby={`${tabId}-tab-services`}
            style={panelStyle("services")}
          >
            <TenantServices data={operations} />
          </div>
          <article
            className="personal-rental-panel"
            role="tabpanel"
            id={`${tabId}-panel-connection`}
            aria-labelledby={`${tabId}-tab-connection`}
            style={panelStyle("connection")}
          >
            <BotLinkPanel token={session.token} />
          </article>
        </>
      )}
      <article
        className={isTenant ? "personal-rental-panel" : "surface surface--wide"}
        role={isTenant ? "tabpanel" : undefined}
        id={isTenant ? `${tabId}-panel-leases` : undefined}
        aria-labelledby={isTenant ? `${tabId}-tab-leases` : undefined}
        style={isTenant ? panelStyle("leases") : undefined}
      >
        <div className="surface-head">
          <div>
            <h3>
              {isTenant
                ? `Договоры · ${listedLeases.length}`
                : t.sectionHeads.leases}
            </h3>
          </div>
        </div>
        <div className="stack-list">
          {!overview.leases.length && (
            <p className="personal-empty">Договоров пока нет</p>
          )}
          {listedLeases.map((lease) => {
            const remaining = endingDays(lease);
            return (
              <div className="list-row" key={lease.id}>
                <div>
                  <strong>{lease.contractNumber}</strong>
                  <p>
                    {isTenant ? (
                      <>
                        Помещение {lease.unitNumber ?? "—"} ·{" "}
                        {lease.propertyName ?? "—"}
                      </>
                    ) : (
                      <>
                        {lease.tenantName ?? "—"} · {lease.propertyName ?? "—"}{" "}
                        · {lease.unitNumber ?? "—"}
                      </>
                    )}
                  </p>
                  <IconButton
                    label={`Документы договора ${lease.contractNumber}`}
                    onClick={() => void loadLeaseDocuments(lease)}
                    type="button"
                  >
                    <ActionIcon name="document" />
                  </IconButton>
                </div>
                <div className="list-aside">
                  <span className={`status-pill status-pill--${lease.stage}`}>
                    {t.leaseStages[lease.stage as keyof typeof t.leaseStages]}
                  </span>
                  <small>{formatDate(lease.endDate, locale)}</small>
                  {isTenant && remaining !== null && remaining <= 45 && (
                    <Badge tone={remaining <= 15 ? "danger" : "warning"}>
                      {remaining < 0
                        ? "Срок истёк"
                        : remaining === 0
                          ? "Истекает сегодня"
                          : `Осталось ${remaining} дн.`}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {isTenant ? (
        proofOpen && (
          <SidePanel
            title={
              locale === "ru"
                ? "Отправить оплату на проверку"
                : "Send payment for review"
            }
            onClose={closeProof}
            busy={busyAction === "payment-proof"}
            dirty={Boolean(
              paymentProofForm.amount ||
              paymentProofForm.reference ||
              paymentProofFile ||
              paymentProofForm.paidAt !== new Date().toISOString().slice(0, 10),
            )}
            footer={
              <Button
                variant="primary"
                form={proofId}
                busy={busyAction === "payment-proof"}
                type="submit"
              >
                {locale === "ru" ? "Отправить менеджеру" : "Send to manager"}
              </Button>
            }
          >
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <form
              id={proofId}
              className="form-grid personal-payment-proof"
              onSubmit={handlePaymentProofSubmit}
            >
              <fieldset disabled={busyAction === "payment-proof"}>
                <label className="personal-proof-contract">
                  <span>{t.fields.contractNumber}</span>
                  <Select
                    name="leaseId"
                    onChange={handleFieldChange(setPaymentProofForm)}
                    value={paymentProofForm.leaseId}
                  >
                    {overview.leases.map((lease) => (
                      <option key={lease.id} value={lease.id}>
                        {lease.contractNumber} · {lease.unitNumber ?? "—"}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="personal-proof-amount">
                  <span>{locale === "ru" ? "Сумма" : "Amount"}</span>
                  <Input
                    name="amount"
                    inputMode="decimal"
                    onChange={handleFieldChange(setPaymentProofForm)}
                    type="number"
                    value={paymentProofForm.amount}
                  />
                </label>
                <label className="personal-proof-date">
                  <span>{locale === "ru" ? "Дата оплаты" : "Paid at"}</span>
                  <Input
                    name="paidAt"
                    onChange={handleFieldChange(setPaymentProofForm)}
                    type="date"
                    value={paymentProofForm.paidAt}
                  />
                </label>
                <label className="personal-proof-reference">
                  <span>
                    {locale === "ru"
                      ? "Номер платежки / комментарий"
                      : "Payment reference / comment"}
                  </span>
                  <Input
                    name="reference"
                    onChange={handleFieldChange(setPaymentProofForm)}
                    value={paymentProofForm.reference}
                  />
                </label>
                <label className="personal-proof-category">
                  <span>Категория файла</span>
                  <Select
                    value={documentUploadCategory}
                    onChange={(event) =>
                      setDocumentUploadCategory(
                        event.target
                          .value as (typeof documentCategoryOptions)[number],
                      )
                    }
                  >
                    {documentCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {getDocumentCategoryLabel(category)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label
                  className={
                    paymentProofFile
                      ? "document-upload document-upload--ready"
                      : "document-upload"
                  }
                >
                  <span>
                    {locale === "ru"
                      ? "Чек, платежка или скрин"
                      : "Receipt, payment order, or screenshot"}
                  </span>
                  <span className="file-picker-control">
                    <span className="file-picker-button">
                      {paymentProofFile
                        ? locale === "ru"
                          ? "Заменить файл"
                          : "Replace file"
                        : locale === "ru"
                          ? "Прикрепить файл"
                          : "Attach file"}
                    </span>
                    <span className="file-picker-name">
                      {paymentProofFile
                        ? paymentProofFile.name
                        : locale === "ru"
                          ? "Файл не выбран"
                          : "No file selected"}
                    </span>
                  </span>
                  <Input
                    aria-label="Файл подтверждения оплаты"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(event) => {
                      setPaymentProofFile(
                        event.currentTarget.files?.[0] ?? null,
                      );
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                  <small className="attachment-hint">
                    {supportedFileHint(locale)} · до 100 МБ на файл
                  </small>
                </label>
                {paymentProofFile ? (
                  <div className="file-picked-summary">
                    <span>{getFileKind(paymentProofFile.name)}</span>
                    <strong>{paymentProofFile.name}</strong>
                    <IconButton
                      label="Удалить прикреплённый файл"
                      onClick={() => setPaymentProofFile(null)}
                      type="button"
                    >
                      <ActionIcon name="delete" />
                    </IconButton>
                  </div>
                ) : null}
              </fieldset>
            </form>
          </SidePanel>
        )
      ) : canManagePortfolio ? (
        <article className="surface">
          <div className="surface-head">
            <div>
              <h3>{ui.finance}</h3>
            </div>
          </div>
          <div className="summary-strip summary-strip--vertical">
            <div className="summary-chip">
              <span>
                {ui.collectionRate} · {overview.finance.collectionPeriodLabel}
              </span>
              <strong>{overview.finance.collectionRate}%</strong>
              <small title="Фактически оплачено / начислено за указанный месяц">
                {getCollectionBasisLabel(overview.finance, locale)}
              </small>
            </div>
            <div className="summary-chip">
              <span>{ui.arrears}</span>
              <strong>
                {formatCompactMoney(overview.finance.arrearsAmount, locale)}
              </strong>
            </div>
            <div className="summary-chip">
              <span>{ui.noi}</span>
              <strong>
                {formatCompactMoney(overview.finance.noi, locale)}
              </strong>
            </div>
            <div className="summary-chip">
              <span>{ui.forecast}</span>
              <strong>
                {formatCompactMoney(overview.finance.forecastQuarter, locale)}
              </strong>
              <small>{overview.finance.forecastPeriodLabel}</small>
            </div>
          </div>
        </article>
      ) : null}

      {canManagePortfolio ? (
        <article className="surface surface--wide">
          <div className="surface-head">
            <div>
              <h3>{ui.exports}</h3>
            </div>
          </div>
          <div className="table-shell">
            <ResponsiveTable className="industrial-table">
              <thead>
                <tr>
                  <th>{ui.exports}</th>
                  <th>{ui.scope}</th>
                  <th>{ui.cadence}</th>
                  <th>Status</th>
                  <th>{locale === "ru" ? "Обновлено" : "Updated"}</th>
                  <th>{t.fields.document}</th>
                </tr>
              </thead>
              <tbody>
                {overview.exports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.format}</small>
                    </td>
                    <td>{item.scope}</td>
                    <td>{item.cadence}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${item.status}`}
                      >
                        {ui.exportStatus[item.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(item.updatedAt, locale)}</td>
                    <td>
                      <Button
                        variant="secondary"
                        className="secondary-button secondary-button--compact"
                        onClick={() => void downloadExport(item.id)}
                        type="button"
                      >
                        {managerUi.open}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </div>
        </article>
      ) : null}

      {!isTenant && (
        <article className="surface">
          <div className="surface-head">
            <div>
              <h3>{t.sections.watchlist}</h3>
            </div>
          </div>
          <div className="lease-rail">
            {leaseWatch.length > 0 ? (
              leaseWatch.map((lease) => {
                const remainingDays = daysUntil(lease.endDate);
                const tone =
                  remainingDays !== null && remainingDays <= 15
                    ? "critical"
                    : remainingDays !== null && remainingDays <= 45
                      ? "warning"
                      : "calm";

                return (
                  <article
                    className={`lease-node lease-node--${tone}`}
                    key={lease.id}
                  >
                    <small>{lease.propertyName ?? "—"}</small>
                    <strong>{lease.contractNumber}</strong>
                    <p>
                      {lease.tenantName ?? "—"} · {lease.unitNumber ?? "—"}
                    </p>
                    <span>{formatDate(lease.endDate, locale)}</span>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">{t.hints.noData}</div>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
