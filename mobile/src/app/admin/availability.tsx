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
import { confirm, notify } from "@/lib/confirm";
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

  // Une ligne par plage horaire ; le nom du jour n’apparaît que sur la première plage du jour.
  const rows = WEEKDAYS.flatMap((weekday) =>
    mine
      .filter((rule) => rule.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((rule, index) => ({ rule, dayLabel: index === 0 ? weekdayName(weekday) : "" })),
  );

  const add = () => {
    setError(null);
    if (days.length === 0) return setError(t("pricing.availabilityNoDays"));
    if (!resourceId || !TIME.test(from) || !TIME.test(to) || to <= from) {
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

  const askDelete = async (id: string) => {
    const ok = await confirm({
      title: t("pricing.deleteRangeTitle"),
      message: t("pricing.deleteRangeMessage"),
      confirmLabel: t("admin.delete"),
      destructive: true,
    });
    if (ok) deleteRule.mutate(id, { onError: (err) => notify(t("pricing.deleteRangeTitle"), toUserMessage(err)) });
  };

  return (
    <Screen underHeader refreshing={rules.isRefetching} onRefresh={() => void rules.refetch()}>
      <View style={styles.resource}>
        <AppText variant="bodyStrong">{t("pricing.resourceLabel")}</AppText>
        <ResourceSwitch value={resourceId} onChange={setPicked} />
      </View>

      {rules.isLoading ? (
        <LoadingView />
      ) : rules.isError ? (
        <ErrorView error={rules.error} onRetry={() => void rules.refetch()} />
      ) : mine.length === 0 ? (
        <AppText variant="body">{t("admin.noRules")}</AppText>
      ) : (
        <Card style={styles.list}>
          {rows.map(({ rule, dayLabel }, index) => (
            <View key={rule.id} style={[styles.row, index === rows.length - 1 && styles.lastRow]}>
              <View style={styles.rowText}>
                <AppText variant="bodyStrong" style={styles.dayName}>
                  {dayLabel}
                </AppText>
                <AppText variant="body">
                  {rule.start_time.slice(0, 5)}
                  {" – "}
                  {rule.end_time.slice(0, 5)}
                </AppText>
              </View>
              <Button
                label={t("admin.delete")}
                variant="dangerText"
                style={styles.delete}
                loading={deleteRule.isPending && deleteRule.variables === rule.id}
                onPress={() => void askDelete(rule.id)}
              />
            </View>
          ))}
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
              placeholder="HH:MM"
            />
          </View>
          <View style={styles.time}>
            <TextField label={t("admin.ruleTo")} value={to} onChangeText={setTo} maxLength={5} placeholder="HH:MM" />
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
  resource: { gap: space.sm },
  list: { paddingVertical: space.xs, gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  lastRow: { borderBottomWidth: 0 },
  rowText: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: space.md, paddingVertical: space.sm },
  dayName: { minWidth: 96 },
  delete: { paddingHorizontal: 0, minHeight: 44 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
  error: { color: colors.danger },
});
