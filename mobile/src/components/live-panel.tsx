import { StyleSheet, View } from "react-native";

import { type ParkStatus, useLiveStream } from "@/api/park";
import { Card } from "@/components/card";
import { CurrentBookingEmergency } from "@/components/emergency-button";
import { LivePlayer } from "@/components/live-player";
import { LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";

/** Caméra à deux temps (textes de freepaws.be/journal-de-bord.html). */
export function LivePanel({ status, statusFailed }: { status: ParkStatus | undefined; statusFailed: boolean }) {
  const { t } = useLanguage();
  const parkOpen = Boolean(status) && status?.status !== "not_open";
  const live = useLiveStream(parkOpen);

  if (status?.status === "not_open") {
    return (
      <Card>
        <AppText variant="eyebrow">{t("camera.accessTitle")}</AppText>
        <AppText variant="body">{t("camera.twoTimes")}</AppText>
        <AppText variant="bodyStrong">{t("camera.freeTitle")}</AppText>
        <AppText variant="body">{t("camera.freeText")}</AppText>
        <AppText variant="bodyStrong">{t("camera.reservedTitle")}</AppText>
        <AppText variant="body">{t("camera.reservedText")}</AppText>
      </Card>
    );
  }

  let body;
  if (statusFailed) {
    body = <Placeholder title={t("camera.unavailable")} />;
  } else if (!status || live.isLoading) {
    body = <LoadingView label={t("camera.connecting")} />;
  } else if (live.isError) {
    body = <Placeholder title={t("camera.unavailable")} />;
  } else if (!live.data || live.data.mode === "denied") {
    body =
      status.status === "reserved" ? (
        <Placeholder title={t("camera.reservedTitle")} message={t("camera.reservedShort")} />
      ) : (
        <Placeholder title={t("camera.closed")} />
      );
  } else if (live.data.streams.length === 0) {
    body = <Placeholder title={t("camera.unavailable")} />;
  } else {
    body = (
      <View style={styles.streams}>
        {live.data.streams.map((stream) => (
          <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
        ))}
      </View>
    );
  }

  return (
    <>
      <Card>
        <AppText variant="eyebrow">{t("camera.eyebrow")}</AppText>
        {body}
      </Card>
      {/* Accès privé = réservation en cours : bouton urgence à portée de main. */}
      {live.data?.mode === "private" ? <CurrentBookingEmergency /> : null}
    </>
  );
}

function Placeholder({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.placeholder}>
      <AppText variant="heading" style={styles.placeholderText}>
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
    aspectRatio: 16 / 9,
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
