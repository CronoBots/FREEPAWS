import { router, Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { type ScrollView, StyleSheet, View } from "react-native";

import { useBookEvent, useBookSlot } from "@/api/bookings";
import { useDogs } from "@/api/dogs";
import { type Service } from "@/api/services";
import { type Slot, useSlots } from "@/api/slots";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { DayPicker } from "@/components/day-picker";
import { SlotGrid } from "@/components/slot-grid";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme";
import { addDays, dayParts, formatDayLong, formatTime, toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";

/** Fenêtre affichée dans le sélecteur (bornée côté serveur par max_advance_days). */
const WINDOW_DAYS = 30;

export function ServiceBooking({ service }: { service: Service }) {
  const { userId } = useAuth();
  const today = toIsoDay(new Date());
  const lastDay = addDays(today, Math.min(service.max_advance_days, WINDOW_DAYS));
  const slots = useSlots(service.id, today, lastDay);
  const dogs = useDogs();

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [dogId, setDogId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const selectSlot = (slot: Slot | null) => {
    setSelected(slot);
    // Amène le choix du chien et le message à l’écran.
    if (slot && userId) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const bookSlot = useBookSlot();
  const bookEvent = useBookEvent();
  const submitting = bookSlot.isPending || bookEvent.isPending;

  const { days, byDay } = useMemo(() => {
    const groups: Record<string, Slot[]> = {};
    for (const slot of slots.data ?? []) (groups[toIsoDay(slot.startsAt)] ??= []).push(slot);
    const allDays: string[] = [];
    for (let day = today; day <= lastDay; day = addDays(day, 1)) allDays.push(day);
    return { days: allDays, byDay: groups };
  }, [slots.data, today, lastDay]);

  const counts = Object.fromEntries(days.map((day) => [day, byDay[day]?.length ?? 0]));
  const activeDay = pickedDay ?? days.find((day) => (counts[day] ?? 0) > 0) ?? null;
  const daySlots = activeDay ? (byDay[activeDay] ?? []) : [];

  const onConfirm = () => {
    if (!selected) return;
    setError(null);
    const callbacks = {
      onSuccess: (bookingId: string) =>
        router.replace({ pathname: "/booking/[id]", params: { id: bookingId, created: "1" } }),
      onError: (err: unknown) => {
        setError(toUserMessage(err));
        selectSlot(null);
      },
    };
    if (service.mode === "event") {
      if (!selected.appointmentId) return;
      bookEvent.mutate({ appointmentId: selected.appointmentId, dogId, notes }, callbacks);
    } else {
      bookSlot.mutate({ serviceId: service.id, startsAt: selected.startsAt, dogId, notes }, callbacks);
    }
  };

  const footer = !userId ? (
    <Button label="Se connecter pour réserver" onPress={() => router.push("/sign-in")} />
  ) : (
    <Button
      label={
        selected
          ? `Confirmer · ${dayParts(toIsoDay(selected.startsAt)).weekday} ${formatTime(selected.startsAt)}`
          : "Choisissez un créneau"
      }
      disabled={!selected}
      loading={submitting}
      onPress={onConfirm}
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen
        underHeader
        heading={service.name}
        scrollRef={scrollRef}
        footer={footer}
        refreshing={slots.isRefetching}
        onRefresh={() => void slots.refetch()}
      >
        <View style={styles.intro}>
          <AppText variant="body">{service.description || service.summary}</AppText>
          {formatPrice(service.price_cents) ? (
            <AppText variant="bodyStrong">{formatPrice(service.price_cents)}</AppText>
          ) : null}
        </View>

        <AppText variant="heading">Choisissez un jour</AppText>
        {slots.isLoading ? (
          <LoadingView label="Recherche des créneaux…" />
        ) : slots.isError ? (
          <ErrorView error={slots.error} onRetry={() => void slots.refetch()} />
        ) : (slots.data?.length ?? 0) === 0 ? (
          <EmptyView
            title={service.mode === "event" ? "Aucune séance programmée" : "Aucun créneau disponible"}
            message="Nous publions régulièrement de nouvelles disponibilités. Vous pouvez aussi nous écrire."
          />
        ) : (
          <>
            <DayPicker
              days={days}
              selected={activeDay}
              counts={counts}
              onSelect={(day) => {
                setPickedDay(day);
                selectSlot(null);
              }}
            />
            {activeDay ? <AppText variant="heading">{formatDayLong(`${activeDay}T12:00:00Z`)}</AppText> : null}
            <SlotGrid
              wide={service.mode === "event"}
              items={daySlots.map((slot) => ({
                key: slot.startsAt,
                label:
                  service.mode === "event"
                    ? `${formatTime(slot.startsAt)} · ${slot.remaining}\u00a0place${slot.remaining > 1 ? "s" : ""}`
                    : formatTime(slot.startsAt),
                accessibilityLabel: `${formatTime(slot.startsAt)} à ${formatTime(slot.endsAt)}`,
                selected: selected?.startsAt === slot.startsAt,
                onPress: () => selectSlot(selected?.startsAt === slot.startsAt ? null : slot),
              }))}
            />
          </>
        )}

        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}

        {userId && selected ? (
          <View style={styles.details}>
            <AppText variant="heading">Pour quel chien ?</AppText>
            <View style={styles.slots}>
              <Chip label="Non précisé" selected={dogId === null} onPress={() => setDogId(null)} />
              {dogs.data?.map((dog) => (
                <Chip key={dog.id} label={dog.name} selected={dogId === dog.id} onPress={() => setDogId(dog.id)} />
              ))}
              <Chip
                label="+ Ajouter"
                selected={false}
                onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: "new" } })}
              />
            </View>
            <TextField
              label="Un mot pour nous (facultatif)"
              placeholder="Particularités de votre chien, questions…"
              value={notes}
              onChangeText={setNotes}
              maxLength={1000}
              multiline
            />
            <AppText variant="caption">
              Annulation gratuite jusqu’à {service.cancel_notice_hours} h avant le début.
            </AppText>
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  details: { gap: space.md },
  error: { color: colors.danger },
});
