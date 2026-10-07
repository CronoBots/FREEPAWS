import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAddRules, useAvailabilityRules, useDeleteRule } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { ResourceSwitch, useDefaultResource } from "@/components/resource-switch";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { weekdayName } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export default function AdminAvailabilityRoute() {
  return (
    <AdminGuard>
      <Availability />
    </AdminGuard>
  );
}

function Availability() {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const resourceId = useDefaultResource(picked);
  const rules = useAvailabilityRules();
  const addRules = useAddRules();
  const deleteRule = useDeleteRule();
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mine = (rules.data ?? []).filter((rule) => rule.resource_id === resourceId);

  const add = () => {
    setError(null);
    if (!resourceId || days.length === 0 || !TIME.test(from) || !TIME.test(to) || to <= from) {
      return setError(t("admin.invalidTime"));
    }
    addRules.mutate(
      days.map((weekday) => ({ resource_id: resourceId, weekday, start_time: from, end_time: to })),
      {
        onSuccess: () => {
          setDays([]);
          setFrom("");
          setTo("");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Screen underHeader refreshing={rules.isRefetching} onRefresh={() => void rules.refetch()}>
      <ResourceSwitch value={resourceId} onChange={setPicked} />

      {rules.isLoading ? (
        <LoadingView />
      ) : rules.isError ? (
        <ErrorView error={rules.error} onRetry={() => void rules.refetch()} />
      ) : mine.length === 0 ? (
        <AppText variant="body">{t("admin.noRules")}</AppText>
      ) : (
        <Card>
          {WEEKDAYS.map((weekday) => {
            const ranges = mine.filter((rule) => rule.weekday === weekday);
            if (ranges.length === 0) return null;
            return (
              <View key={weekday} style={styles.day}>
                <AppText variant="bodyStrong">{weekdayName(weekday)}</AppText>
                {ranges.map((rule) => (
                  <View key={rule.id} style={styles.range}>
                    <AppText variant="body" style={styles.rangeText}>
                      {rule.start_time.slice(0, 5)}
                      {" –⁠ "}
                      {rule.end_time.slice(0, 5)}
                    </AppText>
                    <Button
                      label={t("admin.delete")}
                      variant="ghost"
                      loading={deleteRule.isPending && deleteRule.variables === rule.id}
                      onPress={() => deleteRule.mutate(rule.id)}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </Card>
      )}

      <Card>
        <AppText variant="heading">{t("admin.addRule")}</AppText>
        <AppText variant="bodyStrong">{t("admin.ruleDays")}</AppText>
        <View style={styles.chips}>
          {WEEKDAYS.map((weekday) => (
            <Chip
              key={weekday}
              label={weekdayName(weekday, "short")}
              selected={days.includes(weekday)}
              onPress={() => setDays(days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday])}
            />
          ))}
        </View>
        <View style={styles.times}>
          <View style={styles.time}>
            <TextField
              label={t("admin.ruleFrom")}
              value={from}
              onChangeText={setFrom}
              maxLength={5}
              placeholder="09:00"
            />
          </View>
          <View style={styles.time}>
            <TextField label={t("admin.ruleTo")} value={to} onChangeText={setTo} maxLength={5} placeholder="12:00" />
          </View>
        </View>
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("admin.addRule")} loading={addRules.isPending} onPress={add} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { gap: space.xs, paddingVertical: space.xs },
  range: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rangeText: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
  error: { color: colors.danger },
});
