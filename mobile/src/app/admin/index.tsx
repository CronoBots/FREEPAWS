import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { type AgendaEntry, useAgenda, useCancelAppointment } from "@/api/admin";
import { useIsAdmin, useProfile } from "@/api/profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DayPicker } from "@/components/day-picker";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { confirm, notify } from "@/lib/confirm";
import { space } from "@/theme";
import { addDays, formatDayLong, formatTime, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const DAYS = 21;

export default function AdminAgendaRoute() {
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const today = toIsoDay(new Date());
  const [day, setDay] = useState(today);

  const { from, to, days } = useMemo(() => {
    const list = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
    // Bornes larges (UTC) : le regroupement par jour se fait ensuite en heure de Bruxelles.
    return { from: new Date(`${today}T00:00:00Z`), to: new Date(`${addDays(today, DAYS)}T00:00:00Z`), days: list };
  }, [today]);

  const agenda = useAgenda(from, to);
  const cancel = useCancelAppointment();

  if (profile.isLoading)
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  if (!isAdmin) {
    return (
      <Screen underHeader>
        <EmptyView title="Accès réservé" message="Cette page est réservée à l'équipe FreePaws." />
      </Screen>
    );
  }

  const entries = agenda.data ?? [];
  const counts = Object.fromEntries(days.map((d) => [d, entries.filter((e) => toIsoDay(e.start) === d).length]));
  const dayEntries = entries.filter((entry) => toIsoDay(entry.start) === day);

  const onCancel = async (entry: AgendaEntry) => {
    const ok = await confirm({
      title: "Annuler ce rendez-vous ?",
      message: `${entry.service?.name ?? ""} à ${formatTime(entry.start)}. Les inscrits devront être prévenus.`,
      confirmLabel: "Annuler le rendez-vous",
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(entry.id, { onError: (error) => notify("Annulation impossible", toUserMessage(error)) });
  };

  return (
    <Screen underHeader refreshing={agenda.isRefetching} onRefresh={() => void agenda.refetch()}>
      <Button label="Planifier un atelier" variant="secondary" onPress={() => router.push("/admin/new-event")} />
      {/* Tous les jours restent sélectionnables, même vides. */}
      <DayPicker
        days={days}
        selected={day}
        onSelect={setDay}
        counts={Object.fromEntries(days.map((d) => [d, Math.max(1, counts[d] ?? 0)]))}
      />
      <AppText variant="heading">
        {formatDayLong(`${day}T12:00:00Z`)} · {counts[day] ?? 0} rendez-vous
      </AppText>

      {agenda.isLoading ? (
        <LoadingView />
      ) : agenda.isError ? (
        <ErrorView error={agenda.error} onRetry={() => void agenda.refetch()} />
      ) : dayEntries.length === 0 ? (
        <EmptyView title="Journée libre" message="Aucun rendez-vous ce jour-là." />
      ) : (
        dayEntries.map((entry) => (
          <Card key={entry.id}>
            <AppText variant="eyebrow">
              {formatTime(entry.start)} – {formatTime(entry.end)}
            </AppText>
            <AppText variant="heading">{entry.service?.name}</AppText>
            {entry.service?.mode === "event" ? (
              <AppText variant="caption">
                {entry.bookings.reduce((sum, b) => sum + b.party_size, 0)} / {entry.capacity} places prises
              </AppText>
            ) : null}
            {entry.bookings.length === 0 ? <AppText variant="body">Aucun inscrit pour l’instant.</AppText> : null}
            {entry.bookings.map((booking) => (
              <View key={booking.id} style={styles.booking}>
                <AppText variant="bodyStrong">
                  {booking.client?.full_name || booking.client?.email}
                  {booking.dog ? ` · ${booking.dog.name}${booking.dog.breed ? ` (${booking.dog.breed})` : ""}` : ""}
                </AppText>
                {booking.client?.phone ? (
                  <AppText variant="caption" onPress={() => void Linking.openURL(`tel:${booking.client?.phone}`)}>
                    {booking.client.phone}
                  </AppText>
                ) : null}
                {booking.client_notes ? <AppText variant="caption">« {booking.client_notes} »</AppText> : null}
              </View>
            ))}
            <Button label="Annuler" variant="ghost" onPress={() => void onCancel(entry)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  booking: { gap: 2, paddingTop: space.xs },
});
