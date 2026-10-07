import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { type AgendaEntry, useAgenda, useCancelAppointment } from "@/api/admin";
import { type BookingInfo, useBookingsInfo } from "@/api/v11-admin";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DayPicker } from "@/components/day-picker";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { AdminGuard } from "@/components/admin-guard";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, radius, space } from "@/theme";
import { addDays, formatDayLong, formatTime, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const DAYS = 21;

export default function AdminAgendaRoute() {
  return (
    <AdminGuard>
      <Agenda />
    </AdminGuard>
  );
}

function Agenda() {
  const { t, tp } = useLanguage();
  const today = toIsoDay(new Date());
  const [day, setDay] = useState(today);

  const { from, to, days } = useMemo(() => {
    const list = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
    // Bornes larges (UTC) : le regroupement par jour se fait ensuite en heure de Bruxelles.
    return { from: new Date(`${today}T00:00:00Z`), to: new Date(`${addDays(today, DAYS)}T00:00:00Z`), days: list };
  }, [today]);

  const agenda = useAgenda(from, to);
  const cancel = useCancelAppointment();
  const info = useBookingsInfo((agenda.data ?? []).flatMap((entry) => entry.bookings.map((booking) => booking.id)));

  const entries = agenda.data ?? [];
  const counts = Object.fromEntries(days.map((d) => [d, entries.filter((e) => toIsoDay(e.start) === d).length]));
  const dayEntries = entries.filter((entry) => toIsoDay(entry.start) === day);

  const onCancel = async (entry: AgendaEntry) => {
    const ok = await confirm({
      title: t("admin.cancelTitle"),
      message: t("admin.cancelMessage", { name: entry.service?.name ?? "", time: formatTime(entry.start) }),
      confirmLabel: t("admin.cancelConfirm"),
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(entry.id, { onError: (error) => notify(t("booking.cancelFailed"), toUserMessage(error)) });
  };

  return (
    <Screen underHeader refreshing={agenda.isRefetching} onRefresh={() => void agenda.refetch()}>
      <Button label={t("admin.planEvent")} variant="secondary" onPress={() => router.push("/admin/new-event")} />
      {/* Tous les jours restent sélectionnables, même vides. */}
      <DayPicker
        days={days}
        selected={day}
        onSelect={setDay}
        counts={Object.fromEntries(days.map((d) => [d, 1]))}
        marks={agenda.isSuccess ? counts : {}}
        markLabel={(label, count) =>
          count > 0
            ? tp("admin.dayAppointmentsA11y", count, { day: label })
            : t("admin.dayNoAppointmentA11y", { day: label })
        }
      />
      <View>
        <AppText variant="heading">{formatDayLong(`${day}T12:00:00Z`)}</AppText>
        {/* Compteur seulement s’il y a des rendez-vous : le vide est dit une seule fois, plus bas. */}
        {agenda.isSuccess && (counts[day] ?? 0) > 0 ? (
          <AppText variant="caption">{tp("admin.appointments", counts[day] ?? 0)}</AppText>
        ) : null}
      </View>

      {agenda.isLoading ? (
        <LoadingView />
      ) : agenda.isError ? (
        <ErrorView error={agenda.error} onRetry={() => void agenda.refetch()} />
      ) : dayEntries.length === 0 ? (
        <AppText variant="body" style={styles.muted}>
          {t("admin.freeDayText")}
        </AppText>
      ) : (
        dayEntries.map((entry) => (
          <Card key={entry.id}>
            <AppText variant="eyebrow">
              {formatTime(entry.start)} –⁠ {formatTime(entry.end)}
            </AppText>
            <AppText variant="heading">{entry.service?.name}</AppText>
            {entry.service?.mode === "event" ? (
              <AppText variant="caption">
                {t("admin.places", {
                  taken: entry.bookings.reduce((sum, b) => sum + b.party_size, 0),
                  capacity: entry.capacity,
                })}
              </AppText>
            ) : null}
            {entry.bookings.length === 0 ? <AppText variant="body">{t("admin.noAttendee")}</AppText> : null}
            {entry.bookings.map((booking) => (
              <Pressable
                key={booking.id}
                accessibilityRole="button"
                accessibilityLabel={t("v11Admin.openBooking", {
                  name: booking.client?.full_name || booking.client?.email || "",
                })}
                onPress={() => router.push({ pathname: "/admin/booking/[id]", params: { id: booking.id } })}
                style={({ pressed }) => [styles.booking, pressed && styles.pressed]}
              >
                <View style={styles.bookingHead}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {booking.client?.full_name || booking.client?.email}
                    {/* Tous les chiens de la réservation (parc : plusieurs chiens dans booking_dogs). */}
                    {booking.dogs.length > 0
                      ? ` · ${booking.dogs.map((dog) => `${dog.name}${dog.breed ? ` (${dog.breed})` : ""}`).join(", ")}`
                      : ""}
                  </AppText>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
                </View>
                <BookingBadges info={info.data?.get(booking.id)} />
                {booking.client?.phone ? (
                  <AppText variant="caption" onPress={() => void Linking.openURL(`tel:${booking.client?.phone}`)}>
                    {booking.client.phone}
                  </AppText>
                ) : null}
                {booking.visit_address ? (
                  <AppText variant="caption">{t("admin.address", { address: booking.visit_address })}</AppText>
                ) : null}
                {booking.children_count != null || booking.dogs_count != null ? (
                  <AppText variant="caption">
                    {t("admin.people", {
                      adults: booking.adults_count ?? "—",
                      children: booking.children_count ?? 0,
                      dogs: booking.dogs_count ?? 0,
                    })}
                  </AppText>
                ) : null}
                {booking.client_notes ? <AppText variant="caption">« {booking.client_notes} »</AppText> : null}
              </Pressable>
            ))}
            <Button label={t("admin.cancel")} variant="ghost" onPress={() => void onCancel(entry)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

/** Questionnaire reçu / en attente (si la prestation en a un) et avertissements de santé. */
function BookingBadges({ info }: { info: BookingInfo | undefined }) {
  const { t, tp } = useLanguage();
  if (!info || (!info.hasQuestionnaire && info.healthWarnings.length === 0)) return null;
  return (
    <View style={styles.badges}>
      {info.hasQuestionnaire ? (
        <Badge
          label={info.questionnaireReceived ? t("v11Admin.questionnaireReceived") : t("v11Admin.questionnairePending")}
          tone={info.questionnaireReceived ? "success" : "warning"}
        />
      ) : null}
      {info.healthWarnings.length > 0 ? (
        <Badge label={tp("v11Admin.badgeHealth", info.healthWarnings.length)} tone="danger" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  booking: { gap: 2, paddingTop: space.xs, borderRadius: radius.sm },
  bookingHead: { flexDirection: "row", alignItems: "center", gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, paddingVertical: 2 },
  pressed: { opacity: 0.7 },
  muted: { color: colors.inkSoft },
});
