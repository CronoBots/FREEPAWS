import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useCreateEvent } from "@/api/admin";
import { useServices } from "@/api/services";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Screen } from "@/components/screen";
import { LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { colors, space } from "@/theme";
import { TIME_ZONE } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Convertit une date + heure saisies à Bruxelles en instant UTC. */
function brusselsToDate(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = new Date(`${day}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  // Décalage de Bruxelles à cet instant (1 h ou 2 h selon la saison).
  const local = new Date(guess.toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

export default function NewEventRoute() {
  const services = useServices();
  const create = useCreateEvent();
  const eventServices = services.data?.filter((service) => service.mode === "event") ?? [];
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("10:00");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (services.isLoading)
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  const service = eventServices.find((item) => item.id === serviceId) ?? eventServices[0];

  const submit = () => {
    if (!service) return;
    const start = brusselsToDate(day, time);
    const places = capacity ? Number.parseInt(capacity, 10) : service.default_capacity;
    if (!start || start < new Date()) return setError("Date ou heure invalide (AAAA-MM-JJ et HH:MM, dans le futur).");
    if (!Number.isInteger(places) || places < 1 || places > 50) return setError("Nombre de places entre 1 et 50.");
    setError(null);
    create.mutate(
      {
        serviceId: service.id,
        resourceId: service.resource_id,
        start,
        durationMinutes: service.duration_minutes,
        capacity: places,
      },
      {
        onSuccess: () => router.back(),
        onError: (err) =>
          setError(
            String((err as { message?: string }).message ?? "").includes("appointments_no_overlap")
              ? "Ce créneau chevauche un autre rendez-vous."
              : toUserMessage(err),
          ),
      },
    );
  };

  return (
    <Screen underHeader>
      <AppText variant="heading">Prestation</AppText>
      <View style={styles.row}>
        {eventServices.map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            selected={item.id === service?.id}
            onPress={() => setServiceId(item.id)}
          />
        ))}
      </View>
      <TextField label="Date" placeholder="AAAA-MM-JJ" value={day} onChangeText={setDay} maxLength={10} />
      <TextField
        label="Heure de début (Bruxelles)"
        placeholder="HH:MM"
        value={time}
        onChangeText={setTime}
        maxLength={5}
      />
      <TextField
        label="Places"
        placeholder={String(service?.default_capacity ?? 4)}
        value={capacity}
        onChangeText={(text) => setCapacity(text.replace(/\D/g, ""))}
        keyboardType="number-pad"
        maxLength={2}
      />
      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label="Planifier" loading={create.isPending} disabled={!service} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
