import { useEffect, useId, useState } from "react";
import { hasPermission } from "../../../../../packages/contracts/src/permissions";
import type { BillingInvoice } from "../../shared/types";
import {
  AccountingWorkspace,
  type AccountingView,
} from "../business/AccountingWorkspace";
import { ActionIcon, Feedback, Register } from "../business/shared";
import { BillingForecast } from "./BillingForecast";
import { useWorkspace } from "../../app/WorkspaceContext";
import {
  formatDate,
  formatDateTime,
  reconciliationLabel,
} from "../../shared/format";
import { Badge, Button, IconButton, Input, Select } from "../../ui";
import { WorkspaceTabs } from "../../ui/WorkspaceTabs";
import { WorkspaceHeaderActions } from "../../ui/WorkspaceHeaderActions";
import { SidePanel } from "../../ui/SidePanel";
import {
  billingViews,
  billingViewEvent,
  readBillingView,
  saveBillingView,
  type BillingView,
} from "./billing-view";
import "./workspace.css";
import { formatBillingMoney, paymentTone } from "./format";

export function ManagerBilling() {
  const {
    session,
    selectedBillingInvoice,
    managerUi,
    downloadBillingReconciliation,
    locale,
    downloadExport,
    billingTotals,
    billingInvoices,
    ui,
    pendingPaymentProofTickets,
    setSelectedBillingInvoiceId,
    setBillingPaymentForm,
    openTicketDetail,
    billingReconciliation,
    selectedBillingInvoiceId,
    handleBillingPaymentSubmit,
    handleFieldChange,
    billingPaymentForm,
    busyAction,
    downloadBillingInvoice,
    downloadBillingClosingPack,
    selectedBillingLease,
    loadLeaseDocuments,
    documentPanelLease,
    error: workspaceError,
    notice,
    setError,
  } = useWorkspace();
  const [storedView, setStoredView] = useState<BillingView>(() =>
    readBillingView(session.user.id),
  );
  const [invoiceState, setInvoiceState] = useState("");
  const paymentFormId = useId();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [paymentAttempted, setPaymentAttempted] = useState(false);
  const [documentReturn, setDocumentReturn] = useState<{
    loaded: boolean;
    dirty: boolean;
    draft: typeof billingPaymentForm;
  } | null>(null);
  const canManageSources = hasPermission(session.user, "accounting.manage");
  const canPay = hasPermission(session.user, "billing.write");
  const items = [
    { id: "invoices", label: "Счета", count: billingInvoices.length },
    { id: "accounts", label: "Лицевые счета" },
    {
      id: "reconciliation",
      label: "Сверка",
      count: billingReconciliation?.summary.issues ?? 0,
    },
    { id: "forecast", label: "План доходов" },
    ...(pendingPaymentProofTickets.length
      ? [
          {
            id: "proofs",
            label: "На проверке",
            count: pendingPaymentProofTickets.length,
          },
        ]
      : []),
    ...(canManageSources
      ? [
          { id: "sources", label: "Источники" },
          { id: "links", label: "Сопоставления" },
        ]
      : []),
    ...(canManageSources &&
    session.user.role === "admin" &&
    hasPermission(session.user, "exchange.manage")
      ? [{ id: "exchange", label: "Журнал обмена" }]
      : []),
  ];
  const view = items.some((item) => item.id === storedView)
    ? storedView
    : "invoices";
  useEffect(() => {
    saveBillingView(session.user.id, view);
  }, [session.user.id, view]);
  useEffect(() => {
    const changeView = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; view?: string }>)
        .detail;
      if (
        detail?.userId === session.user.id &&
        billingViews.includes(detail.view as BillingView)
      )
        setStoredView(detail.view as BillingView);
    };
    window.addEventListener(billingViewEvent, changeView);
    return () => window.removeEventListener(billingViewEvent, changeView);
  }, [session.user.id]);
  useEffect(() => {
    if (!documentReturn?.loaded || documentPanelLease) return;
    setBillingPaymentForm(documentReturn.draft);
    setPaymentDirty(documentReturn.dirty);
    setPaymentOpen(true);
    setDocumentReturn(null);
  }, [documentReturn, documentPanelLease, setBillingPaymentForm]);
  useEffect(() => {
    if (!paymentAttempted || busyAction === "billing-payment") return;
    if (
      !workspaceError &&
      ["Оплата проведена", "Payment posted"].includes(notice)
    )
      setPaymentDirty(false);
    setPaymentAttempted(false);
  }, [paymentAttempted, busyAction, workspaceError, notice]);
  const remaining = selectedBillingInvoice
    ? Math.max(
        0,
        selectedBillingInvoice.totalAmount - selectedBillingInvoice.paidAmount,
      )
    : 0;
  function openInvoice(invoice: BillingInvoice, reference = "") {
    setError("");
    setSelectedBillingInvoiceId(invoice.id);
    setBillingPaymentForm({
      amount: String(Math.max(0, invoice.totalAmount - invoice.paidAmount)),
      paidAt: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference,
    });
    setPaymentDirty(false);
    setPaymentOpen(true);
  }
  function closeInvoice() {
    setPaymentOpen(false);
    setPaymentDirty(false);
    setBillingPaymentForm({
      amount: String(remaining),
      paidAt: new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference: "",
    });
  }
  async function openInvoiceDocuments() {
    if (!selectedBillingLease) return;
    setDocumentReturn({
      loaded: false,
      dirty: paymentDirty,
      draft: { ...billingPaymentForm },
    });
    setPaymentOpen(false);
    try {
      await loadLeaseDocuments(selectedBillingLease);
    } finally {
      setDocumentReturn((current) =>
        current ? { ...current, loaded: true } : current,
      );
    }
  }
  const accountingView = ["accounts", "sources", "links", "exchange"].includes(
    view,
  )
    ? (view as AccountingView)
    : null;
  return (
    <section className="mvp-page billing-page billing-workspace">
      <div className="mvp-page-header">
        <h2>{managerUi.titles.billing}</h2>
        <WorkspaceHeaderActions>
          <IconButton
            label={
              locale === "ru"
                ? "Скачать сверку XLSX"
                : "Download reconciliation XLSX"
            }
            onClick={() => void downloadBillingReconciliation()}
          >
            <ActionIcon name="download" />
          </IconButton>
          <IconButton
            label={
              locale === "ru" ? "Скачать реестр XLSX" : "Download ledger XLSX"
            }
            onClick={() => void downloadExport("billing-ledger")}
          >
            <ActionIcon name="document" />
          </IconButton>
        </WorkspaceHeaderActions>
      </div>
      <WorkspaceTabs
        idPrefix="billing-views"
        label="Разделы платежей"
        items={items}
        value={view}
        onChange={(id) => setStoredView(id as BillingView)}
      />
      <div
        role="tabpanel"
        id={`billing-views-panel-${view}`}
        aria-labelledby={`billing-views-tab-${view}`}
        className="billing-view"
      >
        {accountingView ? (
          <AccountingWorkspace view={accountingView} />
        ) : view === "forecast" ? (
          <BillingForecast />
        ) : view === "reconciliation" ? (
          billingReconciliation ? (
            <>
              <dl className="billing-summary">
                <div>
                  <dt>Собираемость</dt>
                  <dd>{billingReconciliation.summary.collectionRate}%</dd>
                </div>
                <div>
                  <dt>Остаток</dt>
                  <dd>
                    {formatBillingMoney(
                      billingReconciliation.summary.outstanding,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Переплата</dt>
                  <dd>
                    {formatBillingMoney(
                      billingReconciliation.summary.overpaid,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Расхождения</dt>
                  <dd>{billingReconciliation.summary.issues}</dd>
                </div>
              </dl>
              <Register
                title="Сверка оплат"
                rows={billingReconciliation.rows
                  .filter((row) => row.reconciliationStatus !== "matched")
                  .map((row) => ({ ...row, id: row.invoiceId }))}
                searchText={(row) =>
                  `${row.tenantName} ${row.period} ${row.contractNumber} ${row.issue}`
                }
                onSelect={(row) => {
                  const invoice = billingInvoices.find(
                    (i) => i.id === row.invoiceId,
                  );
                  if (invoice) openInvoice(invoice);
                }}
                columns={[
                  {
                    key: "tenant",
                    label: "Арендатор",
                    render: (row) => <strong>{row.tenantName}</strong>,
                  },
                  {
                    key: "period",
                    label: "Период",
                    render: (row) => row.period,
                  },
                  {
                    key: "lease",
                    label: "Договор",
                    render: (row) => row.contractNumber || "—",
                    optional: true,
                  },
                  {
                    key: "issue",
                    label: "Расхождение",
                    render: (row) =>
                      row.issue ||
                      reconciliationLabel(row.reconciliationStatus),
                  },
                  {
                    key: "amount",
                    label: "Сумма",
                    align: "end",
                    render: (row) =>
                      formatBillingMoney(
                        row.outstandingAmount || row.overpaidAmount,
                        locale,
                      ),
                  },
                ]}
                empty="Все счета сходятся с оплатами."
              />
            </>
          ) : (
            <p className="ui-empty">Данные сверки пока не получены.</p>
          )
        ) : view === "proofs" ? (
          <Register
            title="Подтверждения оплаты"
            rows={pendingPaymentProofTickets}
            searchText={(ticket) =>
              `${ticket.number} ${ticket.title} ${ticket.tenantName} ${ticket.unitNumber}`
            }
            onSelect={(ticket) => openTicketDetail(ticket.id)}
            columns={[
              {
                key: "title",
                label: "Заявка",
                render: (ticket) => (
                  <>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.number}</small>
                  </>
                ),
              },
              {
                key: "tenant",
                label: "Арендатор",
                render: (ticket) => (
                  <>
                    {ticket.tenantName ?? "—"}
                    <small>
                      {ticket.propertyName} · {ticket.unitNumber}
                    </small>
                  </>
                ),
              },
              {
                key: "date",
                label: "Получено",
                render: (ticket) => formatDateTime(ticket.createdAt, locale),
                optional: true,
              },
              {
                key: "files",
                label: "Файлы",
                render: (ticket) => ticket.attachmentCount,
              },
              {
                key: "actions",
                label: "Действия",
                render: (ticket) => {
                  const invoice = billingInvoices.find(
                    (i) =>
                      i.tenantId === ticket.tenantId &&
                      i.unitId === ticket.unitId &&
                      i.status !== "paid",
                  );
                  return (
                    <div className="mvp-actions">
                      {invoice && canPay && (
                        <IconButton
                          label="Принять оплату"
                          onClick={(event) => {
                            event.stopPropagation();
                            openInvoice(invoice, ticket.number);
                          }}
                        >
                          <ActionIcon name="check" />
                        </IconButton>
                      )}
                      <IconButton
                        label="Проверить подтверждение"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTicketDetail(ticket.id);
                        }}
                      >
                        <ActionIcon name="document" />
                      </IconButton>
                    </div>
                  );
                },
              },
            ]}
          />
        ) : (
          <>
            <dl className="billing-summary">
              <div>
                <dt>{locale === "ru" ? "Начислено" : "Billed"}</dt>
                <dd>{formatBillingMoney(billingTotals.billed, locale)}</dd>
              </div>
              <div>
                <dt>{locale === "ru" ? "Оплачено" : "Paid"}</dt>
                <dd>{formatBillingMoney(billingTotals.paid, locale)}</dd>
              </div>
              <div>
                <dt>{ui.arrears}</dt>
                <dd
                  className={
                    billingTotals.overdue > 0
                      ? "billing-value--overdue"
                      : undefined
                  }
                >
                  {formatBillingMoney(billingTotals.overdue, locale)}
                </dd>
              </div>
              <div>
                <dt>На проверке</dt>
                <dd>{pendingPaymentProofTickets.length}</dd>
              </div>
            </dl>
            <Register
              title="Счета арендаторов"
              rows={billingInvoices.filter(
                (i) =>
                  !invoiceState ||
                  (invoiceState === "overdue"
                    ? ["overdue", "late"].includes(i.status)
                    : i.status === invoiceState),
              )}
              selectedId={selectedBillingInvoiceId}
              onSelect={(invoice) => openInvoice(invoice)}
              searchText={(i) =>
                `${i.period} ${i.tenantName} ${i.contractNumber}`
              }
              columns={[
                {
                  key: "tenant",
                  label: "Арендатор",
                  render: (i) => <strong>{i.tenantName ?? "—"}</strong>,
                },
                { key: "period", label: "Период", render: (i) => i.period },
                {
                  key: "lease",
                  label: "Договор",
                  render: (i) => i.contractNumber ?? "—",
                  optional: true,
                },
                {
                  key: "amount",
                  label: "Сумма",
                  align: "end",
                  render: (i) => formatBillingMoney(i.totalAmount, locale),
                },
                {
                  key: "paid",
                  label: "Оплачено",
                  align: "end",
                  render: (i) => formatBillingMoney(i.paidAmount, locale),
                  optional: true,
                },
                {
                  key: "date",
                  label: "Срок",
                  render: (i) => formatDate(i.dueDate, locale),
                  optional: true,
                },
                {
                  key: "status",
                  label: "Статус",
                  render: (i) => (
                    <Badge tone={paymentTone(i.status)}>
                      {
                        ui.paymentStatus[
                          i.status as keyof typeof ui.paymentStatus
                        ]
                      }
                    </Badge>
                  ),
                },
              ]}
              filters={
                <label>
                  Оплата
                  <Select
                    value={invoiceState}
                    onChange={(e) => setInvoiceState(e.target.value)}
                  >
                    <option value="">Все счета</option>
                    <option value="paid">Оплачены</option>
                    <option value="partial">Частично оплачены</option>
                    <option value="overdue">Просрочены</option>
                    <option value="upcoming">Ожидают оплаты</option>
                  </Select>
                </label>
              }
              empty="Счетов пока нет."
            />
          </>
        )}
      </div>
      {paymentOpen && selectedBillingInvoice && (
        <SidePanel
          title={`Счёт · ${selectedBillingInvoice.period}`}
          onClose={closeInvoice}
          busy={busyAction === "billing-payment"}
          dirty={paymentDirty}
          footer={
            canPay ? (
              <Button
                variant="primary"
                type="submit"
                form={paymentFormId}
                busy={busyAction === "billing-payment"}
                disabled={remaining <= 0}
              >
                {remaining > 0 ? "Провести оплату" : "Счёт оплачен"}
              </Button>
            ) : undefined
          }
        >
          <Feedback error={workspaceError} />
          <p className="billing-record-party">
            {selectedBillingInvoice.tenantName ?? "—"}
          </p>
          <div className="billing-record-status">
            <Badge tone={paymentTone(selectedBillingInvoice.status)}>
              {ui.paymentStatus[selectedBillingInvoice.status]}
            </Badge>
          </div>
          <dl className="billing-invoice-summary">
            <div>
              <dt>Договор</dt>
              <dd>{selectedBillingInvoice.contractNumber ?? "—"}</dd>
            </div>
            <div>
              <dt>Начислено</dt>
              <dd>
                {formatBillingMoney(selectedBillingInvoice.totalAmount, locale)}
              </dd>
            </div>
            <div>
              <dt>Остаток</dt>
              <dd className="billing-invoice-balance">
                {formatBillingMoney(remaining, locale)}
              </dd>
            </div>
            <div>
              <dt>Срок оплаты</dt>
              <dd>{formatDate(selectedBillingInvoice.dueDate, locale)}</dd>
            </div>
          </dl>
          <div
            className="billing-document-actions"
            role="group"
            aria-label="Документы счёта"
          >
            <IconButton
              label="Скачать счёт XLSX"
              onClick={() =>
                void downloadBillingInvoice(selectedBillingInvoice)
              }
            >
              <ActionIcon name="download" />
            </IconButton>
            <IconButton
              label="Скачать закрывающие XLSX"
              onClick={() =>
                void downloadBillingClosingPack(selectedBillingInvoice)
              }
            >
              <ActionIcon name="document" />
            </IconButton>
            {selectedBillingLease && (
              <IconButton
                label="Документы договора"
                onClick={() => void openInvoiceDocuments()}
              >
                <ActionIcon name="link" />
              </IconButton>
            )}
          </div>
          {canPay && (
            <form
              className="form-grid form-grid--single billing-payment-form"
              id={paymentFormId}
              onSubmit={(event) => {
                setPaymentAttempted(true);
                void handleBillingPaymentSubmit(event);
              }}
              onChange={() => setPaymentDirty(true)}
            >
              <h3>Принять оплату</h3>
              <div className="billing-form-row">
                <label>
                  Сумма оплаты
                  <Input
                    required
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    name="amount"
                    type="number"
                    value={billingPaymentForm.amount}
                    onChange={handleFieldChange(setBillingPaymentForm)}
                  />
                </label>
                <label>
                  Дата оплаты
                  <Input
                    required
                    name="paidAt"
                    type="date"
                    value={billingPaymentForm.paidAt}
                    onChange={handleFieldChange(setBillingPaymentForm)}
                  />
                </label>
              </div>
              <div className="billing-form-row">
                <label>
                  Способ
                  <Select
                    name="method"
                    value={billingPaymentForm.method}
                    onChange={handleFieldChange(setBillingPaymentForm)}
                  >
                    <option value="bank_transfer">Безналичный перевод</option>
                    <option value="cash">Наличные</option>
                    <option value="offset">Взаимозачёт</option>
                  </Select>
                </label>
                <label>
                  Назначение / референс
                  <Input
                    name="reference"
                    value={billingPaymentForm.reference}
                    onChange={handleFieldChange(setBillingPaymentForm)}
                  />
                </label>
              </div>
            </form>
          )}
        </SidePanel>
      )}
    </section>
  );
}
