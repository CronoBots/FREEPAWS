import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Linking, Platform, Pressable, Share, StyleSheet, View } from "react-native";

import {
  type EmergencyBooking,
  useAcknowledgeEmergency,
  useEmergencyOverview,
  useParkSettings,
} from "@/api/admin-park";
import { RescueAccessCard } from "@/components/admin/extra/rescue-access";
import { CallRow } from "@/components/admin/safety/call-button";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, fonts, radius, space } from "@/theme";
import { formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function AdminEmergencyRoute() {
  return (
    <AdminGuard>
      <Emergency />
    </AdminGuard>
  );
}

function Emergency() {
  const { t } = useLanguage();
  const overview = useEmergencyOverview();
  const settings = useParkSettings();
  const acknowledge = useAcknowledgeEmergency();

  const bookings = overview.data ?? [];
  const alerts = bookings
    .flatMap((booking) => booking.emergencies.map((alert) => ({ ...alert, booking })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const refresh = () => {
    void overview.refetch();
    void settings.refetch();
  };

  return (
    <Screen underHeader refreshing={overview.isRefetching} onRefresh={refresh}>
      {alerts.map((alert) => (
        <Card key={alert.id} style={styles.alert} accessibilityRole="alert">
          <View style={styles.alertHead}>
            <Ionicons name="warning" size={22} color={colors.danger} />
            <AppText variant="heading" style={[styles.flex, styles.dangerText]}>
              {t("adminSafety.alertsTitle")}
            </AppText>
          </View>
          <AppText variant="bodyStrong">
            {t("adminSafety.alertFrom", { name: alert.booking.full_name, time: formatTime(alert.created_at) })}
          </AppText>
          <AppText variant="body">{alert.message?.trim() || t("adminSafety.noMessage")}</AppText>
          <CallRow name={alert.booking.full_name} phone={alert.booking.phone} />
          <Button
            label={t("adminSafety.acknowledge")}
            variant="danger"
            loading={acknowledge.isPending && acknowledge.variables === alert.id}
            onPress={() =>
              acknowledge.mutate(alert.id, {
                onError: (err) => notify(t("adminSafety.acknowledge"), toUserMessage(err)),
              })
            }
          />
        </Card>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("adminSafety.call112")}
        accessibilityHint={t("adminSafety.call112Hint")}
        onPress={() => void Linking.openURL("tel:112").catch(() => undefined)}
        style={({ pressed }) => [styles.call112, pressed && styles.pressed]}
      >
        <Ionicons name="call" size={28} color={colors.white} />
        <AppText style={styles.call112Label}>{t("adminSafety.call112")}</AppText>
      </Pressable>
      <AppText variant="caption" style={styles.center}>
        {t("adminSafety.call112Hint")}
      </AppText>

      <AppText variant="heading">{t("adminSafety.onSiteTitle")}</AppText>
      <AppText variant="caption">{t("adminSafety.autoRefresh")}</AppText>
      {overview.isLoading ? (
        <LoadingView />
      ) : overview.isError ? (
        <ErrorView error={overview.error} onRetry={() => void overview.refetch()} />
      ) : bookings.length === 0 ? (
        <EmptyView title={t("adminSafety.nothingOnSite")} />
      ) : (
        bookings.map((booking) => (
          <BookingCard key={booking.booking_id} booking={booking} now={overview.dataUpdatedAt} />
        ))
      )}

      <Card>
        <AppText variant="heading">{t("adminSafety.rescueTitle")}</AppText>
        {settings.isLoading ? (
          <LoadingView />
        ) : settings.isError ? (
          <ErrorView error={settings.error} onRetry={() => void settings.refetch()} />
        ) : settings.data?.rescue_info.trim() ? (
          <RescueInfo text={settings.data.rescue_info.trim()} />
        ) : (
          <>
            <AppText variant="body">{t("adminSafety.rescueEmpty")}</AppText>
            <Button
              label={t("adminSafety.openParkRules")}
              variant="secondary"
              onPress={() => router.push("/admin/park-rules")}
            />
          </>
        )}
      </Card>

      <RescueAccessCard />
    </Screen>
  );
}

function RescueInfo({ text }: { text: string }) {
  const { t } = useLanguage();
  const share = async () => {
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(text);
        notify(t("adminSafety.copied"), t("adminSafety.copiedText"));
      } else {
        await Share.share({ message: text });
      }
    } catch (err) {
      notify(t("adminSafety.share"), toUserMessage(err));
    }
  };
  return (
    <>
      <AppText variant="body" selectable>
        {text}
      </AppText>
      <Button label={t("adminSafety.share")} variant="secondary" onPress={() => void share()} />
    </>
  );
}

/** `now` : instant du dernier rafraîchissement (toutes les 30 s), pour « en cours » / « à venir ». */
function BookingCard({ booking, now }: { booking: EmergencyBooking; now: number }) {
  const { t, tp } = useLanguage();
  const inProgress = new Date(booking.starts_at).getTime() <= now && now < new Date(booking.ends_at).getTime();
  const party = [
    booking.adults_count != null ? tp("adminSafety.adults", booking.adults_count) : null,
    booking.children_count ? tp("adminSafety.children", booking.children_count) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card style={booking.emergencies.length > 0 && styles.cardDanger}>
      <View style={styles.head}>
        <Badge
          label={inProgress ? t("adminSafety.inProgress") : t("adminSafety.upcoming")}
          tone={inProgress ? "success" : "warning"}
        />
        <AppText variant="bodyStrong">{`${formatTime(booking.starts_at)} – ${formatTime(booking.ends_at)}`}</AppText>
      </View>
      <AppText variant="caption">{booking.service_name}</AppText>

      <CallRow name={booking.full_name} phone={booking.phone} />
      {party ? <AppText variant="body">{party}</AppText> : null}
      {booking.emergency_contact_name || booking.emergency_contact_phone ? (
        <CallRow
          caption={t("adminSafety.emergencyContact")}
          name={booking.emergency_contact_name || t("adminSafety.emergencyContact")}
          phone={booking.emergency_contact_phone}
        />
      ) : (
        <AppText variant="caption">{t("adminSafety.noEmergencyContact")}</AppText>
      )}

      {booking.dogs.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="bodyStrong">{t("adminSafety.dogs")}</AppText>
          {booking.dogs.map((dog) => (
            <View key={dog.id} style={[styles.dog, dog.protocol && styles.dogProtocol]}>
              <AppText variant="bodyStrong">{[dog.name, dog.breed].filter(Boolean).join(" · ")}</AppText>
              {dog.protocol || dog.bite_history ? (
                <View style={styles.badges}>
                  {dog.protocol ? <Badge label={t("adminSafety.protocolDog")} tone="danger" /> : null}
                  {dog.bite_history ? <Badge label={t("adminSafety.biteHistory")} tone="danger" /> : null}
                </View>
              ) : null}
              {dog.protocol && dog.protocol_note?.trim() ? (
                <AppText variant="body">{dog.protocol_note.trim()}</AppText>
              ) : null}
              {dog.reactivity?.trim() ? (
                <AppText variant="caption">{t("adminSafety.reactivity", { value: dog.reactivity.trim() })}</AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {booking.guests.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="bodyStrong">{t("adminSafety.guests")}</AppText>
          {booking.guests.map((guest, index) => (
            <CallRow key={`${guest.full_name}-${index}`} name={guest.full_name} phone={guest.phone} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  alert: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1.5 },
  alertHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  dangerText: { color: colors.danger },
  call112: {
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  call112Label: { fontFamily: fonts.sansSemiBold, fontSize: 20, lineHeight: 26, color: colors.white },
  pressed: { opacity: 0.82 },
  center: { textAlign: "center" },
  cardDanger: { borderColor: colors.danger, borderWidth: 1.5 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  section: { gap: space.xs, paddingTop: space.xs },
  dog: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  dogProtocol: { borderColor: colors.danger, borderWidth: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
