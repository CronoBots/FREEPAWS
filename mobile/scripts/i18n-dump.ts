// Liste tous les textes de l'app (clé, français, anglais), textes relus compris, en JSON.
// Utilisé par scripts/i18n-xlsx.py (npm run i18n:export / i18n:import).
import { en as baseEn } from "../src/i18n/en";
import { fr as baseFr } from "../src/i18n/fr";
import reviewed from "../src/i18n/reviewed.json";
import { withReviewed } from "../src/i18n/reviewed";

function flatten(node: object, prefix = ""): [string, string][] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value as object, `${prefix}${key}.`),
  );
}

const fr = new Map(flatten(withReviewed(baseFr, reviewed.fr)));
const en = new Map(flatten(withReviewed(baseEn, reviewed.en)));
const rows = [...fr.keys()].map((key) => ({ key, fr: fr.get(key) ?? "", en: en.get(key) ?? "" }));
process.stdout.write(JSON.stringify(rows));
