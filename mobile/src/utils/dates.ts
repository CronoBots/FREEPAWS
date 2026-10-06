// Toutes les dates affichées le sont en heure de Bruxelles, quel que soit le fuseau du téléphone.
export const TIME_ZONE = "Europe/Brussels";
const LOCALE = "fr-BE";

const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayLongFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const isoDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "14:30" */
export function formatTime(date: Date | string): string {
  return timeFormat.format(new Date(date));
}

/** "Mercredi 14 octobre" */
export function formatDayLong(date: Date | string): string {
  const text = dayLongFormat.format(new Date(date));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Jour calendaire à Bruxelles au format AAAA-MM-JJ. */
export function toIsoDay(date: Date | string): string {
  return isoDayFormat.format(new Date(date));
}

/** Ajoute des jours à une date AAAA-MM-JJ (arithmétique calendaire pure, sans fuseau). */
export function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Libellés d'un jour AAAA-MM-JJ pour un sélecteur : { weekday: "mer.", day: "14", month: "oct." } */
export function dayParts(isoDay: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = isoDay.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...options }).format(date);
  return { weekday: fmt({ weekday: "short" }), day: String(d), month: fmt({ month: "short" }) };
}

/** Durée lisible : 90 → "1h30", 120 → "2h", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
