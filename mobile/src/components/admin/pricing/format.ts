import { getLocale, t, tp } from "@/i18n";
import type { PricingRule } from "@/api/pricing";
import { formatPrice } from "@/utils/format";
import { weekdayName } from "@/utils/dates";

/** Montant saisi en euros (virgule ou point, signe facultatif) → centimes, ou null si invalide. */
export function parseEuros(text: string, { allowNegative = false } = {}): number | null {
  const clean = text.trim().replace(/\s/g, "").replace("−", "-").replace(",", ".");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  if (!Number.isFinite(cents) || Math.abs(cents) > 10_000_000) return null;
  if (cents < 0 && !allowNegative) return null;
  return cents;
}

/** Centimes → texte modifiable (« 12,5 » en français). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  const text = String(cents / 100);
  return getLocale().startsWith("fr") ? text.replace(".", ",") : text;
}

/** « +5,00 € » / « −5,00 € » */
export function formatSigned(cents: number): string {
  return `${cents < 0 ? "−" : "+"}${formatPrice(Math.abs(cents)) ?? ""}`;
}

/** Heure Postgres « 09:00:00 » → « 09:00 ». */
export function shortTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "";
}

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Adresse secrète : on n’affiche que le schéma, le domaine et les 4 derniers caractères. */
export function maskUrl(url: string): string {
  const match = /^([a-z]+:\/\/)([^/?#]+)(.*)$/i.exec(url.trim());
  if (!match) return "…";
  const rest = match[3] ?? "";
  return `${match[1]}${match[2]}/…${rest.length > 8 ? rest.slice(-4) : ""}`;
}

/** Jours de la semaine abrégés (1 = lundi … 7 = dimanche). */
export function weekdaysText(days: readonly number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => weekdayName(day, "short"))
    .join(", ");
}

/** Résumé lisible d’une règle de prix. */
export function ruleSummary(rule: PricingRule): string {
  if (rule.kind === "group") {
    return tp("pricing.groupSummary", rule.threshold, { amount: formatPrice(rule.value) ?? "" });
  }
  if (rule.kind === "extra_dog") {
    return tp("pricing.extraDogSummary", rule.threshold, { amount: formatPrice(rule.value) ?? "" });
  }
  const when: string[] = [];
  if (rule.weekdays.length > 0) when.push(weekdaysText(rule.weekdays));
  if (rule.on_public_holidays) when.push(t("pricing.publicHolidays"));
  if (rule.on_school_holidays) when.push(t("pricing.schoolHolidays"));
  const from = shortTime(rule.start_time);
  const to = shortTime(rule.end_time);
  const hours =
    from && to
      ? t("pricing.fromTo", { from, to })
      : from
        ? t("pricing.fromOnly", { from })
        : to
          ? t("pricing.untilOnly", { to })
          : t("pricing.allDay");
  const effect =
    rule.adjustment === "percent"
      ? t("pricing.percentValue", { value: `${rule.value < 0 ? "−" : "+"}${Math.abs(rule.value)}` })
      : rule.adjustment === "amount"
        ? formatSigned(rule.value)
        : t("pricing.fixedValue", { price: formatPrice(rule.value) ?? "" });
  return `${when.join(" · ")} · ${hours} → ${effect}`;
}
