import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { getLanguage, t, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { openStoredFile } from "@/lib/files";
import { colors, space } from "@/theme";
import { addDays, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Carte de section avec un titre. */
export function Section({ title, right, children }: PropsWithChildren<{ title: string; right?: ReactNode }>) {
  return (
    <Card>
      <View style={styles.sectionHead}>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        {right}
      </View>
      {children}
    </Card>
  );
}

/** « Libellé : valeur », retour à la ligne sur petit écran. */
export function InfoLine({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useLanguage();
  return (
    <View style={styles.info}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="body" style={styles.value}>
        {value?.trim() ? value : t("adminClients.notProvided")}
      </AppText>
    </View>
  );
}

/** Rangée de badges qui passe à la ligne. */
export function BadgeRow({ children }: PropsWithChildren) {
  return <View style={styles.badges}>{children}</View>;
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
      {children}
    </AppText>
  );
}

/** Ouvre un justificatif (bucket privé « proofs ») et signale l’échec. */
export function openProof(path: string) {
  openStoredFile("proofs", path).catch((error) => notify(t("adminClients.proofFailed"), toUserMessage(error)));
}

/** Nom d’un vaccin dans la langue courante (translations.en.name), sinon le nom français. */
export function vaccineName(vaccine: { name: string; translations?: unknown } | null | undefined) {
  if (!vaccine) return "";
  const translations = vaccine.translations as Record<string, { name?: string } | undefined> | null | undefined;
  return translations?.[getLanguage()]?.name?.trim() || vaccine.name;
}

/** Espaces insécables : un numéro de téléphone n’est jamais coupé sur deux lignes. */
export function keepTogether(text: string) {
  return text.replace(/ /g, " ");
}

export function todayIso() {
  return toIsoDay(new Date());
}

export type ValidityStatus = "valid" | "expiring" | "expired" | "missing";

/** Validité d’une date de fin (AAAA-MM-JJ) : expire bientôt dans les 30 jours. */
export function validity(until: string | null | undefined, soonDays = 30): ValidityStatus {
  if (!until) return "missing";
  const today = todayIso();
  if (until < today) return "expired";
  if (until <= addDays(today, soonDays)) return "expiring";
  return "valid";
}

/** Libellé de date à partir d’un jour AAAA-MM-JJ (midi UTC : pas de décalage de fuseau). */
export function dayDate(isoDay: string) {
  return `${isoDay}T12:00:00Z`;
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  flex: { flexShrink: 1, flexGrow: 1 },
  info: { gap: 2 },
  value: { color: colors.ink },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
