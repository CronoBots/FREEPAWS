import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useGuestLive } from "@/api/pricing";
import { useGuestInvitation } from "@/api/v11-client";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { GuestProfileForm } from "@/components/v11/guest-profile-form";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { formatDayLong, formatTime, toIsoDay } from "@/utils/dates";

/** Direct du parc pour un invité : lien personnel, sans compte, valable pendant le créneau.
 *  L’invité complète d’abord un profil allégé (M2-10), puis accède au direct. */
export default function GuestLiveRoute() {
  const { t } = useLanguage();
  const { token } = useLocalSearchParams<{ token: string }>();
  const invitation = useGuestInvitation(token);
  const guest = invitation.data;
  // Le direct n’est demandé qu’une fois le profil complété.
  const live = useGuestLive(guest?.profileCompleted ? token : undefined);
  const data = live.data;
  // Le serveur peut encore exiger le profil (mode « profile_required ») : on réaffiche le formulaire.
  const profileRequired = Boolean(guest) && (!guest?.profileCompleted || (data?.mode as string) === "profile_required");
  const firstName = (guest?.fullName || data?.guestName)?.trim().split(/\s+/)[0];

  let body;
  if (invitation.isLoading) {
    body = <LoadingView label={t("parkBooking.liveLoading")} />;
  } else if (invitation.isError) {
    body = <ErrorView error={invitation.error} onRetry={() => void invitation.refetch()} />;
  } else if (!guest) {
    body = <Placeholder title={t("v11Client.guestInvalidTitle")} message={t("v11Client.guestInvalidText")} />;
  } else if (profileRequired) {
    body = null;
  } else if (live.isLoading) {
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
    <Screen
      underHeader
      refreshing={invitation.isRefetching || live.isRefetching}
      onRefresh={() => void Promise.all([invitation.refetch(), guest?.profileCompleted ? live.refetch() : null])}
    >
      {/* Tant que le profil est à compléter, la page est un formulaire d’invitation, pas encore le direct. */}
      <Stack.Screen
        options={{ title: guest && profileRequired ? t("v11Client.guestHeaderTitle") : t("admin.liveGuestTitle") }}
      />
      {firstName ? (
        <AppText variant="title" accessibilityRole="header">
          {t("parkBooking.liveHello", { name: firstName })}
        </AppText>
      ) : null}
      {guest ? (
        <View style={styles.reminder}>
          {guest.hostName ? (
            <AppText variant="bodyStrong">{t("v11Client.guestInvitedBy", { host: guest.hostName })}</AppText>
          ) : null}
          <AppText variant="body">{guest.serviceName}</AppText>
          {guest.startsAt && guest.endsAt ? (
            <AppText variant="body">
              {t("v11Client.guestSlot", {
                day: formatDayLong(guest.startsAt),
                start: formatTime(guest.startsAt),
                end: formatTime(guest.endsAt),
              })}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {guest && profileRequired && token ? (
        <GuestProfileForm key={token} token={token} invitation={guest} />
      ) : (
        <Card>{body}</Card>
      )}
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
  reminder: { gap: space.xs },
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
