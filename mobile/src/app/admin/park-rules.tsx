import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useParkSettings, useUpdateParkSettings } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

type Settings = NonNullable<ReturnType<typeof useParkSettings>["data"]>;
type RuleMode = "off" | "warn" | "block";
type RuleKey = "min_age_rule" | "heat_rule" | "illness_rule" | "antiparasitic_rule";

// M2-09 : chaque règle de santé est désactivée, simple avertissement ou bloquante, au choix.
const RULES: [RuleKey, TranslationKey][] = [
  ["min_age_rule", "adminSafety.ruleMinAge"],
  ["heat_rule", "adminSafety.refuseHeat"],
  ["illness_rule", "adminSafety.refuseIll"],
  ["antiparasitic_rule", "adminSafety.requireAntiparasitic"],
];
const MODES: [RuleMode, TranslationKey][] = [
  ["off", "adminSafety.modeOff"],
  ["warn", "adminSafety.modeWarn"],
  ["block", "adminSafety.modeBlock"],
];

export default function AdminParkRulesRoute() {
  return (
    <AdminGuard>
      <ParkRules />
    </AdminGuard>
  );
}

function ParkRules() {
  const settings = useParkSettings();
  if (settings.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (settings.isError || !settings.data) {
    return (
      <Screen underHeader>
        <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />
      </Screen>
    );
  }
  return <RulesForm settings={settings.data} />;
}

function RulesForm({ settings }: { settings: Settings }) {
  const { t } = useLanguage();
  const update = useUpdateParkSettings();
  const [minAge, setMinAge] = useState(settings.min_dog_age_months == null ? "" : String(settings.min_dog_age_months));
  const [rules, setRules] = useState<Record<RuleKey, RuleMode>>({
    min_age_rule: settings.min_age_rule as RuleMode,
    heat_rule: settings.heat_rule as RuleMode,
    illness_rule: settings.illness_rule as RuleMode,
    antiparasitic_rule: settings.antiparasitic_rule as RuleMode,
  });
  const [expiryDays, setExpiryDays] = useState(String(settings.expiry_alert_days));
  const [rescue, setRescue] = useState(settings.rescue_info);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    const age = minAge.trim() === "" ? null : Number(minAge);
    if (age != null && (!Number.isInteger(age) || age < 0 || age > 60)) {
      return setError(t("adminSafety.invalidNumber", { field: t("adminSafety.minAge") }));
    }
    const days = Number(expiryDays);
    if (expiryDays.trim() === "" || !Number.isInteger(days) || days < 1 || days > 120) {
      return setError(t("adminSafety.invalidNumber", { field: t("adminSafety.expiryDays") }));
    }
    update.mutate(
      {
        min_dog_age_months: age,
        ...rules,
        expiry_alert_days: days,
        rescue_info: rescue.trim(),
      },
      { onSuccess: () => notify(t("adminSafety.saved"), ""), onError: (err) => setError(toUserMessage(err)) },
    );
  };

  return (
    <Screen underHeader footer={<Button label={t("common.save")} loading={update.isPending} onPress={save} />}>
      <Card>
        <AppText variant="heading">{t("adminSafety.rulesTitle")}</AppText>
        <TextField
          label={t("adminSafety.minAge")}
          hint={t("adminSafety.minAgeHint")}
          value={minAge}
          onChangeText={(text) => setMinAge(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={2}
        />
        <AppText variant="caption">{t("adminSafety.rulesModesText")}</AppText>
        {RULES.map(([key, label]) => (
          <View key={key} style={styles.rule}>
            <AppText variant="bodyStrong">{t(label)}</AppText>
            <Segmented
              accessibilityLabel={t(label)}
              options={MODES.map(([mode, modeLabel]) => ({ value: mode, label: t(modeLabel) }))}
              value={rules[key]}
              onChange={(mode) => setRules({ ...rules, [key]: mode })}
            />
          </View>
        ))}
        <View style={styles.rule}>
          <TextField
            label={t("adminSafety.expiryDays")}
            hint={t("adminSafety.expiryHint")}
            value={expiryDays}
            onChangeText={(text) => setExpiryDays(text.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </Card>

      <Card>
        <AppText variant="heading">{t("adminSafety.rescueTitle")}</AppText>
        <TextField
          label={t("adminSafety.rescueField")}
          hint={t("adminSafety.rescueHint")}
          value={rescue}
          onChangeText={setRescue}
          multiline
          maxLength={4000}
          style={styles.rescue}
          textAlignVertical="top"
        />
      </Card>

      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rescue: { minHeight: 180 },
  // Filet et marge entre deux règles : chaque règle se lit comme un bloc distinct.
  rule: {
    gap: space.sm,
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  error: { color: colors.danger },
});
