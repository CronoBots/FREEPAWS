import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { type Bucket, openStoredFile, type PickedFile, pickFile } from "@/lib/files";
import { notify } from "@/lib/confirm";
import { space } from "@/theme";
import { addDays, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Jour du calendrier AAAA-MM-JJ qui existe vraiment (refuse 2026-02-31). */
export function isValidIsoDay(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && date.toISOString().slice(0, 10) === value;
}

/** Aujourd’hui à Bruxelles, AAAA-MM-JJ. */
export function todayIso(): string {
  return toIsoDay(new Date());
}

/** État d’une date de fin de validité : valable, expire dans moins de 30 jours, expirée. */
export function validityState(validUntil: string): "valid" | "expiring" | "expired" {
  const today = todayIso();
  if (validUntil < today) return "expired";
  if (validUntil < addDays(today, 30)) return "expiring";
  return "valid";
}

/** Rangée de puces à choix unique ; toucher la puce choisie la désélectionne si `allowNone`. */
export function ChoiceRow<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
  allowNone = true,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowNone?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(value === option.value && allowNone ? null : option.value)}
          />
        ))}
      </View>
    </View>
  );
}

/** Oui / Non / Non précisé, pour une colonne booléenne facultative. */
export function YesNoUnknown({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  const { t } = useLanguage();
  const current = value === null ? "unknown" : value ? "yes" : "no";
  return (
    <ChoiceRow
      label={label}
      allowNone={false}
      value={current}
      onChange={(next) => onChange(next === "yes" ? true : next === "no" ? false : null)}
      options={[
        { value: "yes", label: t("fiche.yes") },
        { value: "no", label: t("fiche.no") },
        { value: "unknown", label: t("fiche.unknown") },
      ]}
    />
  );
}

/**
 * Justificatif (PDF ou photo) : choix d’un fichier, envoyé plus tard à l’enregistrement,
 * et ouverture du fichier déjà enregistré.
 */
export function ProofField({
  label,
  storedPath,
  picked,
  onPick,
  bucket = "proofs",
}: {
  label: string;
  storedPath: string | null;
  picked: PickedFile | null;
  onPick: (file: PickedFile) => void;
  bucket?: Bucket;
}) {
  const { t } = useLanguage();
  const [opening, setOpening] = useState(false);

  const choose = async () => {
    try {
      const file = await pickFile("proof");
      if (file) onPick(file);
    } catch (error) {
      notify(t("fiche.pickFailed"), toUserMessage(error));
    }
  };

  const open = async () => {
    if (!storedPath) return;
    setOpening(true);
    try {
      await openStoredFile(bucket, storedPath);
    } catch (error) {
      notify(t("fiche.openFailed"), toUserMessage(error));
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.field}>
      <AppText variant="bodyStrong">{label}</AppText>
      <AppText variant="caption">
        {picked
          ? t("fiche.proofSelected", { name: picked.name })
          : storedPath
            ? t("fiche.proofHint")
            : `${t("fiche.proofNone")} ${t("fiche.proofHint")}`}
      </AppText>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label={storedPath || picked ? t("fiche.proofReplace") : t("fiche.proofAdd")}
          onPress={() => void choose()}
        />
        {storedPath ? (
          <Button variant="ghost" label={t("fiche.proofView")} loading={opening} onPress={() => void open()} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  actions: { gap: space.sm },
});
