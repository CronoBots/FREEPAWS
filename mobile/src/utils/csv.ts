type Cell = string | number | boolean | null | undefined;

function escape(value: Cell): string {
  if (value == null) return "";
  const text = String(value);
  // Neutralise les formules (=, +, -, @) à l’ouverture dans un tableur.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV séparé par des points-virgules (ouverture directe dans Excel en Belgique), avec BOM UTF-8. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return "﻿" + [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n") + "\r\n";
}
