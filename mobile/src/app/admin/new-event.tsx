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
import { AdminGuard } from "@/components/admin-guard";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { brusselsDateTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function NewEventRoute() {
  return (
    <AdminGuard>
      <NewEvent />
    </AdminGuard>
  );
}

function NewEvent() {
  const { t } = useLanguage();
  const services = useServices();
  const create = useCreateEvent();
  const eventServices =
    services.data?.filter((service) => service.mode === "event" && service.duration_minutes != null) ?? [];
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
    const start = brusselsDateTime(day, time);
    const places = capacity ? Number.parseInt(capacity, 10) : service.default_capacity;
    if (!start || start < new Date()) return setError(t("admin.invalidDate"));
    if (!Number.isInteger(places) || places < 1 || places > 50) return setError(t("admin.invalidPlaces"));
    setError(null);
    create.mutate(
      {
        serviceId: service.id,
        resourceId: service.resource_id,
        start,
        durationMinutes: service.duration_minutes ?? 0,
        capacity: places,
      },
      {
        onSuccess: () => router.back(),
        onError: (err) =>
          setError(
            String((err as { message?: string }).message ?? "").includes("appointments_no_overlap")
              ? t("admin.overlap")
              : toUserMessage(err),
          ),
      },
    );
  };

  return (
    <Screen underHeader>
      <AppText variant="heading">{t("admin.service")}</AppText>
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
      <TextField
        label={t("admin.date")}
        placeholder={t("dogs.datePlaceholder")}
        value={day}
        onChangeText={setDay}
        maxLength={10}
      />
      <TextField
        label={t("admin.time")}
        placeholder={t("admin.timePlaceholder")}
        value={time}
        onChangeText={setTime}
        maxLength={5}
      />
      <TextField
        label={t("admin.places_label")}
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
      <Button label={t("admin.plan")} loading={create.isPending} disabled={!service} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger },
});
