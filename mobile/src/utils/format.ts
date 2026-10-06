const euro = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number | null | undefined): string {
  return cents == null ? "Tarif sur demande" : euro.format(cents / 100);
}
