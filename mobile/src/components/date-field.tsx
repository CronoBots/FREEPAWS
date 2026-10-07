import { useState } from "react";

import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";

type Props = {
  label: string;
  /** Date AAAA-MM-JJ, ou "" tant que la saisie est vide ou incomplète. */
  value: string;
  onChange: (isoDay: string) => void;
  hint?: string;
  error?: string;
  editable?: boolean;
};

/** "2026-10-27" → "27/10/2026" */
export function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** "27/10/2026" → "2026-10-27", ou null si la date n’existe pas. */
export function displayToIso(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match as unknown as [string, string, string, string];
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

/** Ajoute les barres au fil de la frappe : "2710" → "27/10". */
function mask(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Saisie d’une date au format belge JJ/MM/AAAA ; la valeur échangée reste au format ISO. */
export function DateField({ label, value, onChange, hint, error, editable }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState(() => isoToDisplay(value));

  // Valeur changée de l’extérieur (chargement de la fiche, remise à zéro du formulaire) :
  // on resynchronise pendant le rendu, sans effet.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== (displayToIso(text) ?? "")) setText(isoToDisplay(value));
  }

  const [blurred, setBlurred] = useState(false);
  const complete = text.length === 10;
  // Date incomplète signalée en quittant le champ : sinon elle passerait silencieusement pour « vide ».
  const invalid = (complete && displayToIso(text) === null) || (blurred && text.length > 0 && !complete);

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(input) => {
        const next = mask(input);
        setText(next);
        setBlurred(false);
        onChange(next.length === 10 ? (displayToIso(next) ?? "") : "");
      }}
      placeholder={t("common.datePlaceholder")}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={10}
      // Le format reste visible une fois le champ rempli (le texte d’exemple disparaît) : 04/05 est ambigu en anglais.
      // Format rappelé sous le champ une fois rempli (le texte grisé le montre quand il est vide).
      hint={hint ?? (text ? t("common.datePlaceholder") : undefined)}
      error={error ?? (invalid ? t("common.dateInvalid") : undefined)}
      editable={editable}
      onBlur={() => setBlurred(true)}
    />
  );
}
