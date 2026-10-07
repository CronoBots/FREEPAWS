import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useGuestLive } from "@/api/pricing";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { formatDayLong, formatTime, toIsoDay } from "@/utils/dates";

/** Direct du parc pour un invité : lien personnel, sans compte, valable pendant le créneau. */
export default function GuestLiveRoute() {
  const { t } = useLanguage();
  const { token } = useLocalSearchParams<{ token: string }>();
  const live = useGuestLive(token);
  const data = live.data;
  const firstName = data?.guestName?.trim().split(/\s+/)[0];

  let body;
  if (live.isLoading) {
    body = <LoadingView label={t("parkBooking.liveLoading")} />;
  } else if (live.isError) {
    body = <ErrorView error={live.error} onRetry={() => void live.refetch()} />;
  } else if (!data || data.mode === "denied") {
    body = <Placeholder title={t("parkBooking.liveDenied")} message={t("parkBooking.liveDeniedText")} />;
  } else if (data.mode === "not_started") {
    const startsAt = data.startsAt;
    const title = !startsAt
      ? t("parkBooking.liveSoon")
      : toIsoDay(startsAt) === toIsoDay(new Date())
        ? t("parkBooking.liveNotStarted", { time: formatTime(startsAt) })
        : t("parkBooking.liveNotStartedDay", { day: formatDayLong(startsAt), time: formatTime(startsAt) });
    body = <Placeholder title={title} message={t("parkBooking.liveNotStartedText")} />;
  } else if (data.streams.length === 0) {
    body = <Placeholder title={t("parkBooking.liveSoon")} />;
  } else {
    body = (
      <View style={styles.streams}>
        {data.streams.map((stream) => (
          <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
        ))}
        {data.endsAt ? (
          <AppText variant="caption">{t("parkBooking.liveUntil", { time: formatTime(data.endsAt) })}</AppText>
        ) : null}
      </View>
    );
  }

  return (
    <Screen underHeader refreshing={live.isRefetching} onRefresh={() => void live.refetch()}>
      {firstName ? (
        <AppText variant="title" accessibilityRole="header">
          {t("parkBooking.liveHello", { name: firstName })}
        </AppText>
      ) : null}
      <Card>{body}</Card>
    </Screen>
  );
}

function Placeholder({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.placeholder}>
      <AppText variant="heading" style={styles.placeholderText} accessibilityRole="alert">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" style={[styles.placeholderText, styles.placeholderBody]}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  streams: { gap: space.sm },
  placeholder: {
    minHeight: 180,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
  },
  placeholderText: { color: colors.cream, textAlign: "center" },
  placeholderBody: { opacity: 0.85, fontSize: 14, lineHeight: 20 },
});
