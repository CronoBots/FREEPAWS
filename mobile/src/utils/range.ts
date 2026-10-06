export type TimeRange = { start: Date; end: Date };

/**
 * Lit un tstzrange Postgres tel que renvoyé par l’API :
 * ["2026-10-14 08:00:00+00","2026-10-14 09:00:00+00")
 */
export function parseRange(value: string): TimeRange {
  const match = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(value.trim());
  if (!match) throw new Error(`Plage horaire illisible : ${value}`);
  const toDate = (raw: string) => new Date(raw.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  const start = toDate(match[1]!);
  const end = toDate(match[2]!);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Plage horaire illisible : ${value}`);
  }
  return { start, end };
}

/** Plage au format accepté par Postgres pour un insert. */
export function toRangeLiteral(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}
