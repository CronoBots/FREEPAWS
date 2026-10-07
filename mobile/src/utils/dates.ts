import { getLocale } from "@/i18n";

// Toutes les dates affichées le sont en heure de Bruxelles, quel que soit le fuseau du téléphone,
// dans la langue choisie (français ou anglais).
export const TIME_ZONE = "Europe/Brussels";

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions, locale = getLocale()) {
  const key = locale + JSON.stringify(options);
  let format = formatters.get(key);
  if (!format) formatters.set(key, (format = new Intl.DateTimeFormat(locale, options)));
  return format;
}
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};
const DAY_LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
};
const isoDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "14:30" */
export function formatTime(date: Date | string): string {
  return formatter(TIME_OPTIONS).format(new Date(date));
}

/** "Mercredi 14 octobre" */
export function formatDayLong(date: Date | string): string {
  const text = formatter(DAY_LONG_OPTIONS).format(new Date(date));
  const withFirst = getLocale().startsWith("fr") ? text.replace(/ 1 /, " 1er ") : text;
  return withFirst.charAt(0).toUpperCase() + withFirst.slice(1);
}

/** "14 octobre 2026" (s’insère au milieu d’une phrase, sans majuscule ; « 1er » en français). */
export function formatDate(date: Date | string): string {
  const text = formatter({ timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(
    new Date(date),
  );
  return unbreakable(getLocale().startsWith("fr") ? text.replace(/^1 /, "1er ") : text);
}

/** "7 octobre 2026 à 20:27" / "7 October 2026 at 20:27" (l’heure ne se sépare jamais du « à »). */
export function formatDateTime(date: Date | string): string {
  const joiner = getLocale().startsWith("fr") ? " à " : " at ";
  return `${formatDate(date)}${joiner}${formatTime(date)}`;
}

/** Espaces insécables : une date ou une durée ne se coupe jamais en fin de ligne. */
function unbreakable(text: string): string {
  return text.replace(/ /g, "\u00a0");
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

/** Libellés d’un jour AAAA-MM-JJ pour un sélecteur : { weekday: "mer.", day: "14", month: "oct." } */
export function dayParts(isoDay: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = isoDay.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (options: Intl.DateTimeFormatOptions) => formatter({ timeZone: "UTC", ...options }).format(date);
  return { weekday: fmt({ weekday: "short" }), day: String(d), month: fmt({ month: "short" }) };
}

/** Durée lisible (espaces insécables) : 90 → "1 h 30", 120 → "2 h", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}\u00a0min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}\u00a0h` : `${h}\u00a0h\u00a0${String(m).padStart(2, "0")}`;
}

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Décalage (ms) de Bruxelles par rapport à UTC à un instant donné (+1 h l’hiver, +2 h l’été). */
function brusselsOffset(instant: Date): number {
  const parts = Object.fromEntries(partsFormat.formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instant correspondant à une date (AAAA-MM-JJ) et une heure (HH:MM) saisies à Bruxelles.
 * Renvoie null si la saisie est invalide ou tombe dans le trou du passage à l’heure d’été.
 */
export function brusselsDateTime(isoDay: string, time: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  const hm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !hm) return null;
  const [y, m, d, h, min] = [day[1], day[2], day[3], hm[1], hm[2]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  const wallClock = Date.UTC(y, m - 1, d, h, min);
  // Deux passes : le décalage dépend de l’instant recherché lui-même.
  let instant = new Date(wallClock - brusselsOffset(new Date(wallClock)));
  instant = new Date(wallClock - brusselsOffset(instant));
  const check = new Date(instant.getTime() + brusselsOffset(instant));
  if (check.getUTCHours() !== h || check.getUTCMinutes() !== min || check.getUTCDate() !== d) return null;
  return instant;
}

/** Nom du jour ISO (1 = lundi … 7 = dimanche) dans la langue courante. */
export function weekdayName(isoWeekday: number, style: "long" | "short" = "long"): string {
  // Le 5 janvier 2026 est un lundi.
  const date = new Date(Date.UTC(2026, 0, 4 + isoWeekday, 12));
  const text = formatter({ timeZone: "UTC", weekday: style }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
