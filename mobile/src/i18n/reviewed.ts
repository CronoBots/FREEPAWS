import type { Dictionary } from "@/i18n/fr";

/**
 * Textes définitifs relus par FreePaws (fichier src/i18n/reviewed.json, rempli par
 * `npm run i18n:import` à partir du tableau de relecture). Chaque entrée « section.clé » remplace
 * le texte du dictionnaire ; une clé inconnue est ignorée (le test i18n la signale).
 */
export function withReviewed(dictionary: Dictionary, overrides: Record<string, string>): Dictionary {
  if (Object.keys(overrides).length === 0) return dictionary;
  const copy = structuredClone(dictionary) as unknown as Record<string, unknown>;
  for (const [key, text] of Object.entries(overrides)) {
    const parts = key.split(".");
    const last = parts.pop();
    let node: Record<string, unknown> | undefined = copy;
    for (const part of parts) node = node?.[part] as Record<string, unknown> | undefined;
    if (node && last && typeof node[last] === "string") node[last] = text;
  }
  return copy as unknown as Dictionary;
}
