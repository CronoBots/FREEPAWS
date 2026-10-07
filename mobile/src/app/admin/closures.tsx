import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { countAppointmentsInPeriod, useBlackouts, useClosePeriod, useDeleteBlackout } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { ResourceSwitch, useDefaultResource } from "@/components/resource-switch";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { brusselsDateTime, formatDayLong, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function AdminClosuresRoute() {
  return (
    <AdminGuard>
      <Closures />
    </AdminGuard>
  );
}

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
    if (!valid || !resourceId || !start || !end) return setError(t("admin.invalidDate"));
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

  const mine = (blackouts.data ?? []).filter((blackout) => blackout.resource_id === resourceId);

  return (
    <Screen underHeader refreshing={blackouts.isRefetching} onRefresh={() => void blackouts.refetch()}>
      <ResourceSwitch value={resourceId} onChange={setPicked} />

      <Card>
        <AppText variant="heading">{t("admin.closeTitle")}</AppText>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <TextField
              label={t("admin.startDate")}
              placeholder={t("dogs.datePlaceholder")}
              value={startDay}
              onChangeText={setStartDay}
              maxLength={10}
            />
          </View>
          <View style={styles.time}>
            <TextField label={t("admin.startTime")} value={startTime} onChangeText={setStartTime} maxLength={5} />
          </View>
        </View>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <TextField
              label={t("admin.endDate")}
              placeholder={t("dogs.datePlaceholder")}
              value={endDay}
              onChangeText={setEndDay}
              maxLength={10}
            />
          </View>
          <View style={styles.time}>
            <TextField label={t("admin.endTime")} value={endTime} onChangeText={setEndTime} maxLength={5} />
          </View>
        </View>
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
        <Button label={t("admin.closeButton")} disabled={!valid} loading={closePeriod.isPending} onPress={submit} />
      </Card>

      <AppText variant="heading">{t("admin.upcomingClosures")}</AppText>
      {blackouts.isLoading ? (
        <LoadingView />
      ) : blackouts.isError ? (
        <ErrorView error={blackouts.error} onRetry={() => void blackouts.refetch()} />
      ) : mine.length === 0 ? (
        <AppText variant="body">{t("admin.noClosures")}</AppText>
      ) : (
        mine.map((blackout) => (
          <Card key={blackout.id}>
            <AppText variant="bodyStrong">
              {formatDayLong(blackout.start)} {formatTime(blackout.start)}
              {" –⁠ "}
              {formatDayLong(blackout.end)} {formatTime(blackout.end)}
            </AppText>
            {blackout.reason ? <AppText variant="body">{blackout.reason}</AppText> : null}
            <Button
              label={t("admin.delete")}
              variant="ghost"
              loading={deleteBlackout.isPending && deleteBlackout.variables === blackout.id}
              onPress={() => deleteBlackout.mutate(blackout.id)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
  time: { width: 110 },
  warning: { color: colors.reserved },
  error: { color: colors.danger },
});
