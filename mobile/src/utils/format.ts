import { getLocale } from "@/i18n";

/** Prix affiché seulement s’il a été renseigné par FreePaws (aucun tarif par défaut). */
export function formatPrice(cents: number | null | undefined): string | null {
  return cents == null
    ? null
    : new Intl.NumberFormat(getLocale(), { style: "currency", currency: "EUR" }).format(cents / 100);
}
