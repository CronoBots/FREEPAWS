import { StyleSheet, View } from "react-native";

import type { Eligibility } from "@/api/v11-client";
import { AppText } from "@/components/text";
import { type TranslationKey, useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

const RULES: Record<string, TranslationKey> = {
  dog_too_young: "v11Client.rule_dog_too_young",
  dog_in_heat: "v11Client.rule_dog_in_heat",
  dog_ill: "v11Client.rule_dog_ill",
  antiparasitic_missing: "v11Client.rule_antiparasitic_missing",
};

/** Aperçu des règles de santé avant de confirmer : erreur bloquante ou avertissements (M2-09). */
export function EligibilityPreview({ loading, data }: { loading: boolean; data: Eligibility | undefined }) {
  const { t } = useLanguage();
  if (loading) return <AppText variant="caption">{t("v11Client.eligibilityChecking")}</AppText>;
  if (!data) return null;
  if (data.error) {
    return (
      <View style={[styles.box, styles.blocked]} accessibilityRole="alert">
        <AppText variant="bodyStrong" style={styles.blockedText}>
          {t("v11Client.eligibilityBlocked")}
        </AppText>
        <AppText variant="body" style={styles.blockedText}>
          {toUserMessage(data.error)}
        </AppText>
      </View>
    );
  }
  if (data.warnings.length === 0) return null;
  return (
    <View style={[styles.box, styles.warning]} accessibilityLiveRegion="polite">
      <AppText variant="bodyStrong">{t("v11Client.warningsTitle")}</AppText>
      {data.warnings.map((warning) => {
        const rule = t(RULES[warning.code] ?? "v11Client.ruleOther");
        return (
          <AppText key={`${warning.code}:${warning.dog}`} variant="body">
            {warning.dog ? t("v11Client.warningLine", { dog: warning.dog, rule }) : rule}
          </AppText>
        );
      })}
      <AppText variant="caption">{t("v11Client.warningsText")}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  blocked: { backgroundColor: colors.dangerSoft },
  blockedText: { color: colors.danger },
  warning: { backgroundColor: colors.reservedSoft },
});
