import type { GroupDog, QuestionOption, SnapshotQuestion } from "@/api/v11-admin";
import { getLanguage, t, type TranslationKey } from "@/i18n";
import { formatDate } from "@/utils/dates";

const HEALTH_LABELS: Record<string, TranslationKey> = {
  dog_too_young: "v11Admin.healthTooYoung",
  dog_in_heat: "v11Admin.healthInHeat",
  dog_ill: "v11Admin.healthIll",
  antiparasitic_missing: "v11Admin.healthAntiparasitic",
};

/** « code:nom du chien » → { label: « Chien trop jeune », dog: « Rex » }. */
export function parseHealthWarning(raw: string): { label: string; dog: string } {
  const index = raw.indexOf(":");
  const code = index < 0 ? raw : raw.slice(0, index);
  const dog = index < 0 ? "" : raw.slice(index + 1).trim();
  const key = HEALTH_LABELS[code];
  return { label: key ? t(key) : t("v11Admin.healthOther", { code }), dog };
}

/** « code:nom du chien » → « Chien trop jeune : Rex ». */
export function healthWarningText(raw: string): string {
  const { label, dog } = parseHealthWarning(raw);
  return dog ? t("v11Admin.healthLine", { label, dog }) : label;
}

/** Avertissements qui portent sur un chien donné (par son nom), pour les afficher sur sa ligne. */
export function healthLabelsForDog(warnings: string[], dogName: string): string[] {
  const name = dogName.trim().toLowerCase();
  return warnings
    .map(parseHealthWarning)
    .filter((warning) => warning.dog.toLowerCase() === name)
    .map((warning) => warning.label);
}

const SIZES: Record<string, TranslationKey> = {
  small: "fiche.sizeSmall",
  medium: "fiche.sizeMedium",
  large: "fiche.sizeLarge",
  giant: "fiche.sizeGiant",
};

/** « Rex · Berger malinois · Grand » (sans la mention protocole, affichée en badge). */
export function dogText(dog: Pick<GroupDog, "name" | "breed" | "size">): string {
  const size = dog.size ? SIZES[dog.size] : undefined;
  return [dog.name, dog.breed?.trim(), size ? t(size) : null].filter(Boolean).join(" · ");
}

function optionLabel(options: QuestionOption[], value: unknown) {
  const option = options.find((item) => item.value === value);
  if (!option) return String(value);
  return (getLanguage() === "en" && option.label_en?.trim()) || option.label;
}

function isEmpty(value: unknown) {
  return (
    value == null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)
  );
}

/** Valeur lisible d’une réponse : oui/non, libellés des choix, dates formatées. */
export function answerText(question: Pick<SnapshotQuestion, "kind" | "options">, value: unknown): string {
  if (isEmpty(value)) return t("v11Admin.noAnswer");
  const options = Array.isArray(question.options) ? question.options : [];
  switch (question.kind) {
    case "yes_no": {
      const yes = value === true || value === "yes" || value === "true" || value === "oui";
      const no = value === false || value === "no" || value === "false" || value === "non";
      return yes ? t("v11Admin.yes") : no ? t("v11Admin.no") : String(value);
    }
    case "single_choice":
      return optionLabel(options, value);
    case "multi_choice":
      return (Array.isArray(value) ? value : [value]).map((item) => optionLabel(options, item)).join(", ");
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? formatDate(`${value}T12:00:00Z`)
        : String(value);
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}
