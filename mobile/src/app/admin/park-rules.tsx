import { useState } from "react";
import { StyleSheet } from "react-native";

import { useParkSettings, useUpdateParkSettings } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors } from "@/theme";
import { toUserMessage } from "@/utils/errors";

type Settings = NonNullable<ReturnType<typeof useParkSettings>["data"]>;

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
  const [refuseHeat, setRefuseHeat] = useState(settings.refuse_dogs_in_heat);
  const [refuseIll, setRefuseIll] = useState(settings.refuse_ill_dogs);
  const [requireAntiparasitic, setRequireAntiparasitic] = useState(settings.require_antiparasitic);
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
        refuse_dogs_in_heat: refuseHeat,
        refuse_ill_dogs: refuseIll,
        require_antiparasitic: requireAntiparasitic,
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
        <Checkbox label={t("adminSafety.refuseHeat")} checked={refuseHeat} onChange={setRefuseHeat} />
        <Checkbox label={t("adminSafety.refuseIll")} checked={refuseIll} onChange={setRefuseIll} />
        <Checkbox
          label={t("adminSafety.requireAntiparasitic")}
          checked={requireAntiparasitic}
          onChange={setRequireAntiparasitic}
        />
        <TextField
          label={t("adminSafety.expiryDays")}
          hint={t("adminSafety.expiryHint")}
          value={expiryDays}
          onChangeText={(text) => setExpiryDays(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
        />
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
  error: { color: colors.danger },
});
