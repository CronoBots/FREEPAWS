// Lecture d'un agenda iCal en plages occupées (utilisé par calendar-import, testé par parse.test.ts).
import ICAL from "npm:ical.js@2";

const HORIZON_DAYS = 400;
const MAX_EVENTS = 5000;

export type Busy = { start: string; end: string };

/** Date ical.js → instant ISO. Les dates sans heure (journée entière) sont lues à Bruxelles. */
function toIso(time: ICAL.Time): string {
  if (time.isDate || time.zone === ICAL.Timezone.localTimezone) {
    // Heure « flottante » ou journée entière : heure de Bruxelles.
    const local = `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00`;
    return brusselsToUtc(local);
  }
  return time.toJSDate().toISOString();
}

/** Convertit une heure locale de Bruxelles (AAAA-MM-JJTHH:MM:SS) en ISO UTC, heure d'été comprise. */
function brusselsToUtc(local: string): string {
  const guess = new Date(`${local}Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}

export function parseBusy(ics: string, now = new Date()): Busy[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  }
  const from = now.getTime() - 86_400_000;
  const to = now.getTime() + HORIZON_DAYS * 86_400_000;
  const busy: Busy[] = [];

  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (component.getFirstPropertyValue("transp") === "TRANSPARENT") continue;
    if (component.getFirstPropertyValue("status") === "CANCELLED") continue;
    // Les exceptions (RECURRENCE-ID) sont traitées par l'événement principal.
    if (event.isRecurrenceException()) continue;

    if (!event.isRecurring()) {
      const start = toIso(event.startDate);
      const end = toIso(event.endDate ?? event.startDate);
      if (Date.parse(end) > from && Date.parse(start) < to) busy.push({ start, end });
      continue;
    }

    const iterator = event.iterator();
    for (let next = iterator.next(); next && busy.length < MAX_EVENTS; next = iterator.next()) {
      const occurrence = event.getOccurrenceDetails(next);
      const start = toIso(occurrence.startDate);
      if (Date.parse(start) >= to) break;
      const end = toIso(occurrence.endDate);
      if (Date.parse(end) > from) busy.push({ start, end });
    }
  }
  return busy.filter((b) => Date.parse(b.end) > Date.parse(b.start)).slice(0, MAX_EVENTS);
}

