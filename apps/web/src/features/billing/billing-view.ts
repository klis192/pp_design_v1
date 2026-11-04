export const billingViews = [
  "invoices",
  "accounts",
  "reconciliation",
  "forecast",
  "sources",
  "links",
  "exchange",
  "proofs",
] as const;
export type BillingView = (typeof billingViews)[number];
export const billingViewEvent = "wirehouse:billing-view";
export function billingViewStorageKey(userId: string) {
  return `wirehouse.billing.view.v2:${userId}`;
}
export function readBillingView(userId: string): BillingView {
  try {
    const value = sessionStorage.getItem(billingViewStorageKey(userId));
    return billingViews.includes(value as BillingView)
      ? (value as BillingView)
      : "invoices";
  } catch {
    return "invoices";
  }
}
export function saveBillingView(userId: string, value: BillingView) {
  try {
    sessionStorage.setItem(billingViewStorageKey(userId), value);
  } catch {
    /* Explicit navigation remains available without browser storage. */
  }
}
export function requestBillingView(userId: string, view: BillingView) {
  saveBillingView(userId, view);
  window.dispatchEvent(
    new CustomEvent(billingViewEvent, { detail: { userId, view } }),
  );
}
