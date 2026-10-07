import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useCreateEvent } from "@/api/admin";
import { useServices } from "@/api/services";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DateField } from "@/components/date-field";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { brusselsDateTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Ajoute les deux-points au fil de la frappe : "1030" → "10:30". */
function maskTime(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

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
  // null : la valeur par défaut de la prestation choisie, affichée comme une vraie saisie.
  const [capacity, setCapacity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (services.isLoading) {
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  }
  if (services.isError) {
    return (
      <Screen underHeader>
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      </Screen>
    );
  }
  const service = eventServices.find((item) => item.id === serviceId) ?? eventServices[0];
  const places = capacity ?? (service ? String(service.default_capacity) : "");

  const submit = () => {
    if (!service) return;
    const start = brusselsDateTime(day, time);
    const count = Number.parseInt(places, 10);
    if (!start) return setError(t("adminExtra.invalidDate"));
    if (start < new Date()) return setError(t("adminExtra.eventPast"));
    if (!Number.isInteger(count) || count < 1 || count > 50) return setError(t("admin.invalidPlaces"));
    setError(null);
    create.mutate(
      {
        serviceId: service.id,
        resourceId: service.resource_id,
        start,
        durationMinutes: service.duration_minutes ?? 0,
        capacity: count,
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
    <Screen
      underHeader
      footer={
        <View style={styles.footer}>
          {error ? (
            <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button label={t("admin.plan")} loading={create.isPending} disabled={!service} onPress={submit} />
        </View>
      }
    >
      <Card>
        <AppText variant="heading">{t("admin.service")}</AppText>
        {eventServices.length === 0 ? (
          <AppText variant="body" style={styles.muted}>
            {t("adminExtra.eventNoService")}
          </AppText>
        ) : (
          <View accessibilityRole="radiogroup">
            {eventServices.map((item, index) => {
              const selected = item.id === service?.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={item.name}
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    setServiceId(item.id);
                    setCapacity(null);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    index === eventServices.length - 1 && styles.optionLast,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={selected ? colors.ink : colors.inkSoft}
                  />
                  <AppText variant={selected ? "bodyStrong" : "body"} style={styles.optionLabel}>
                    {item.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <DateField label={t("admin.date")} value={day} onChange={setDay} />
        <TextField
          label={t("adminExtra.eventTime")}
          placeholder={t("admin.timePlaceholder")}
          value={time}
          onChangeText={(text) => setTime(maskTime(text))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
        />
        <TextField
          label={t("adminExtra.eventPlaces")}
          hint={t("adminExtra.eventPlacesHint")}
          value={places}
          onChangeText={(text) => setCapacity(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={2}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  optionLast: { borderBottomWidth: 0 },
  optionLabel: { flex: 1 },
  pressed: { opacity: 0.75 },
  muted: { color: colors.inkSoft },
  footer: { gap: space.sm },
  error: { color: colors.danger },
});
