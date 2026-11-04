import type { Locale } from "../../projectData";

const money = {
  ru: new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
  en: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
};

export const formatBillingMoney = (value: number, locale: Locale = "ru") =>
  money[locale].format(value);

export const paymentTone = (status: string) =>
  status === "paid"
    ? "success"
    : status === "overdue" || status === "late"
      ? "danger"
      : status === "partial"
        ? "warning"
        : "neutral";
