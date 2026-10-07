import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAdminServices } from "@/api/admin";
import { useAdminBookForClient } from "@/api/admin-extra";
import { Section } from "@/components/admin/clients/shared";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useCompact } from "@/hooks/use-compact";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { brusselsDateTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Rendez-vous de suivi posé par l’administratrice pour ce client (durée libre). */
export function ClientBookingForm({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const compact = useCompact();
  const services = useAdminServices();
  const book = useAdminBookForClient();
  const slotServices = (services.data ?? []).filter((service) => service.mode === "slot");

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = slotServices.find((service) => service.id === serviceId) ?? null;

  const choose = (id: string) => {
    setServiceId(id);
    const service = slotServices.find((item) => item.id === id);
    if (service?.duration_minutes && !duration) setDuration(String(service.duration_minutes));
  };

  const submit = () => {
    setError(null);
    if (!selected) return;
    const start = brusselsDateTime(day.trim(), time.trim());
    if (!start) return setError(t("adminExtra.invalidDate"));
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 720) return setError(t("adminExtra.invalidDuration"));
    const priceText = price.trim().replace(",", ".");
    const priceCents = priceText === "" ? null : Math.round(Number(priceText) * 100);
    if (priceCents != null && (!Number.isFinite(priceCents) || priceCents < 0)) {
      return setError(t("adminExtra.invalidPrice"));
    }
    book.mutate(
      {
        serviceId: selected.id,
        clientId,
        startsAt: start,
        durationMinutes: minutes,
        visitAddress: address.trim() || null,
        notes: note.trim() || null,
        priceCents,
      },
      {
        onSuccess: () => {
          notify(t("adminExtra.booked"), t("adminExtra.bookedText"));
          setDay("");
          setTime("");
          setNote("");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Section title={t("adminExtra.bookTitle")}>
      <AppText variant="caption">{t("adminExtra.bookText")}</AppText>
      {slotServices.length === 0 ? (
        <AppText variant="body">{t("adminExtra.noService")}</AppText>
      ) : (
        <>
          <AppText variant="bodyStrong">{t("adminExtra.service")}</AppText>
          <View style={styles.chips}>
            {slotServices.map((service) => (
              <Chip
                key={service.id}
                label={service.name}
                selected={service.id === serviceId}
                onPress={() => choose(service.id)}
              />
            ))}
          </View>
        </>
      )}
      {selected ? (
        <>
          <View style={compact ? styles.stack : styles.row}>
            <View style={compact ? undefined : styles.flex}>
              <TextField label={t("adminExtra.date")} value={day} onChangeText={setDay} maxLength={10} />
            </View>
            <View style={compact ? undefined : styles.flex}>
              <TextField label={t("adminExtra.time")} value={time} onChangeText={setTime} maxLength={5} />
            </View>
          </View>
          <TextField
            label={t("adminExtra.duration")}
            value={duration}
            onChangeText={(text) => setDuration(text.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={3}
          />
          {selected.requires_address ? (
            <TextField label={t("adminExtra.address")} value={address} onChangeText={setAddress} maxLength={300} />
          ) : null}
          <TextField label={t("adminExtra.note")} value={note} onChangeText={setNote} multiline maxLength={1000} />
          <TextField
            label={t("adminExtra.price")}
            hint={t("adminExtra.priceHint")}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            maxLength={8}
          />
          {error ? (
            <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button label={t("adminExtra.book")} loading={book.isPending} onPress={submit} />
        </>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  row: { flexDirection: "row", gap: space.md },
  stack: { gap: space.md },
  flex: { flex: 1 },
  error: { color: colors.danger },
});
