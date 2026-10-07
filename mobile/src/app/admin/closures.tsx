import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { countAppointmentsInPeriod, useBlackouts, useClosePeriod, useDeleteBlackout } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { DateField } from "@/components/date-field";
import { ListRow } from "@/components/list-row";
import { ResourceSwitch, useDefaultResource } from "@/components/resource-switch";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { brusselsDateTime, formatDate, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function AdminClosuresRoute() {
  return (
    <AdminGuard>
      <Closures />
    </AdminGuard>
  );
}

/** « 1er novembre 2026 18:15 », sans coupure de ligne. */
const when = (date: Date | string) => `${formatDate(date)} ${formatTime(date)}`;

function Closures() {
  const { t, tp } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const resourceId = useDefaultResource(picked);
  const blackouts = useBlackouts();
  const closePeriod = useClosePeriod();
  const deleteBlackout = useDeleteBlackout();

  const [startDay, setStartDay] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endDay, setEndDay] = useState("");
  const [endTime, setEndTime] = useState("23:59");
  const [reason, setReason] = useState("");
  const [cancelExisting, setCancelExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = brusselsDateTime(startDay, startTime);
  const end = brusselsDateTime(endDay, endTime);
  const valid = Boolean(resourceId && start && end && end > start);

  // Aperçu : nombre de rendez-vous déjà pris sur la période saisie.
  const preview = useQuery({
    queryKey: ["admin", "affected", resourceId, start, end],
    queryFn: () => countAppointmentsInPeriod(resourceId!, start!, end!),
    enabled: valid,
  });
  const affected = valid ? (preview.data ?? null) : null;

  const submit = () => {
    setError(null);
    if (!valid || !resourceId || !start || !end) return setError(t("pricing.errorClosure"));
    closePeriod.mutate(
      { resourceId, start, end, reason: reason.trim(), cancelExisting },
      {
        onSuccess: (count) => {
          if (cancelExisting) notify(t("admin.closeTitle"), tp("admin.cancelledCount", count ?? 0));
          setStartDay("");
          setEndDay("");
          setReason("");
          setCancelExisting(false);
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  const askDelete = async (id: string) => {
    const ok = await confirm({
      title: t("pricing.deleteClosureTitle"),
      message: t("pricing.deleteClosureMessage"),
      confirmLabel: t("admin.delete"),
      destructive: true,
    });
    if (ok) {
      deleteBlackout.mutate(id, { onError: (err) => notify(t("pricing.deleteClosureTitle"), toUserMessage(err)) });
    }
  };

  const mine = (blackouts.data ?? []).filter((blackout) => blackout.resource_id === resourceId);

  return (
    <Screen underHeader refreshing={blackouts.isRefetching} onRefresh={() => void blackouts.refetch()}>
      <View style={styles.resource}>
        <AppText variant="bodyStrong">{t("pricing.resourceLabel")}</AppText>
        <ResourceSwitch value={resourceId} onChange={setPicked} />
      </View>

      <Card>
        <AppText variant="heading">{t("admin.closeTitle")}</AppText>
        {(
          [
            ["pricing.closureStart", startDay, setStartDay, startTime, setStartTime],
            ["pricing.closureEnd", endDay, setEndDay, endTime, setEndTime],
          ] as const
        ).map(([title, day, setDay, time, setTime]) => (
          <View key={title} style={styles.group}>
            <AppText variant="bodyStrong">{t(title)}</AppText>
            <View style={styles.pair}>
              <View style={styles.date}>
                <DateField label={t("pricing.fieldDate")} value={day} onChange={setDay} />
              </View>
              <View style={styles.time}>
                <TextField
                  label={t("pricing.fieldTime")}
                  value={time}
                  onChangeText={setTime}
                  maxLength={5}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </View>
        ))}
        <TextField label={t("admin.reason")} value={reason} onChangeText={setReason} maxLength={200} />
        {affected ? (
          <>
            <AppText variant="bodyStrong" style={styles.warning}>
              {tp("admin.affected", affected)}
            </AppText>
            <Checkbox label={t("admin.cancelExisting")} checked={cancelExisting} onChange={setCancelExisting} />
          </>
        ) : null}
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("admin.closeButton")} loading={closePeriod.isPending} onPress={submit} />
      </Card>

      <AppText variant="heading">{t("admin.upcomingClosures")}</AppText>
      <Card>
        <AppText variant="body">{t("pricing.closuresExternalNote")}</AppText>
        <ListRow
          label={t("admin.hubCalendarSync")}
          detail={t("admin.hubCalendarSyncDetail")}
          last
          onPress={() => router.push("/admin/calendar-sync")}
        />
      </Card>
      {blackouts.isLoading ? (
        <LoadingView />
      ) : blackouts.isError ? (
        <ErrorView error={blackouts.error} onRetry={() => void blackouts.refetch()} />
      ) : mine.length === 0 ? (
        <AppText variant="body">{t("admin.noClosures")}</AppText>
      ) : (
        mine.map((blackout) => (
          <Card key={blackout.id}>
            <AppText variant="bodyStrong">{t("pricing.closureFrom", { date: when(blackout.start) })}</AppText>
            <AppText variant="bodyStrong">{t("pricing.closureTo", { date: when(blackout.end) })}</AppText>
            {blackout.reason ? <AppText variant="body">{blackout.reason}</AppText> : null}
            <View style={styles.actions}>
              <Button
                label={t("admin.delete")}
                variant="dangerText"
                loading={deleteBlackout.isPending && deleteBlackout.variables === blackout.id}
                onPress={() => void askDelete(blackout.id)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resource: { gap: space.sm },
  group: { gap: space.xs },
  // Champs alignés en bas : un libellé qui passerait sur deux lignes ne décale plus la saisie.
  pair: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: space.md },
  date: { flexGrow: 1, flexBasis: 140 },
  time: { flexGrow: 0, flexBasis: 100 },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
  warning: { color: colors.reserved },
  error: { color: colors.danger },
});
