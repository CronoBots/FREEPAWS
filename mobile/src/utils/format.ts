const euro = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });

/** Prix affiché seulement s’il a été renseigné par FreePaws (aucun tarif par défaut). */
export function formatPrice(cents: number | null | undefined): string | null {
  return cents == null ? null : euro.format(cents / 100);
}
