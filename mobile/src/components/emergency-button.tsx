import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { useMyBookings } from "@/api/bookings";
import { useRaiseEmergency, useRescueInfo } from "@/api/park-profile";
import { PARK_SERVICE_SLUG } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm } from "@/lib/confirm";
import { colors, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

/** Même marge que raise_emergency côté serveur. */
const MARGIN_MS = 15 * 60_000;

type BookingWindow = { status: string; start: Date; end: Date };

export function isEmergencyWindow(booking: BookingWindow, now = Date.now()) {
  return (
    booking.status === "confirmed" &&
    now >= booking.start.getTime() - MARGIN_MS &&
    now <= booking.end.getTime() + MARGIN_MS
  );
}

/** Horloge rafraîchie toutes les 30 s : le bouton apparaît et disparaît tout seul. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Bouton « Urgence », visible de 15 min avant le début à 15 min après la fin d’une réservation confirmée. */
export function EmergencyButton({ booking }: { booking: BookingWindow }) {
  const now = useNow();
  const { t } = useLanguage();
  const raise = useRaiseEmergency();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rescue = useRescueInfo(sent);

  if (!sent && !isEmergencyWindow(booking, now)) return null;

  const onPress = async () => {
    const ok = await confirm({
      title: t("parkBooking.emergencyConfirmTitle"),
      message: t("parkBooking.emergencyConfirmText"),
      confirmLabel: t("parkBooking.emergencyConfirm"),
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    raise.mutate(message.trim() || null, {
      onSuccess: () => setSent(true),
      onError: (err) => setError(toUserMessage(err)),
    });
  };

  const rescueText = typeof rescue.data === "string" ? rescue.data.trim() : "";

  return (
    <Card style={styles.card}>
      <AppText variant="eyebrow" style={styles.danger}>
        {t("parkBooking.emergencyTitle")}
      </AppText>
      {sent ? (
        <View style={styles.sent} accessibilityRole="alert">
          <AppText variant="heading" style={styles.danger}>
            {t("parkBooking.emergencySent")}
          </AppText>
          <AppText variant="body">{t("parkBooking.emergencySentText")}</AppText>
        </View>
      ) : (
        <>
          <Button
            label={t("parkBooking.emergencyButton")}
            variant="danger"
            loading={raise.isPending}
            onPress={() => void onPress()}
            style={styles.big}
          />
          <AppText variant="caption">{t("parkBooking.emergencyHint")}</AppText>
          <TextField
            label={t("parkBooking.emergencyMessage")}
            placeholder={t("parkBooking.emergencyMessagePlaceholder")}
            value={message}
            onChangeText={setMessage}
            maxLength={1000}
          />
        </>
      )}
      {error ? (
        <View accessibilityRole="alert">
          <AppText variant="bodyStrong" style={styles.danger}>
            {t("parkBooking.emergencyFailed")}
          </AppText>
          <AppText variant="body">{error}</AppText>
        </View>
      ) : null}
      {sent || error ? (
        <Button
          label={t("parkBooking.call112")}
          variant="danger"
          onPress={() => void Linking.openURL("tel:112").catch(() => undefined)}
        />
      ) : null}
      {sent && rescueText ? (
        <View style={styles.rescue}>
          <AppText variant="heading">{t("parkBooking.rescueTitle")}</AppText>
          <AppText variant="body">{rescueText}</AppText>
        </View>
      ) : null}
    </Card>
  );
}

/** Variante du direct : retrouve la réservation en cours de l’utilisateur (parc en priorité). */
export function CurrentBookingEmergency() {
  const bookings = useMyBookings();
  const now = useNow();
  const current = (bookings.data ?? []).filter((booking) => isEmergencyWindow(booking, now));
  const booking = current.find((item) => item.service.slug === PARK_SERVICE_SLUG) ?? current[0];
  if (!booking) return null;
  return <EmergencyButton booking={booking} />;
}

const styles = StyleSheet.create({
  card: { borderColor: colors.danger, borderWidth: 1 },
  danger: { color: colors.danger },
  big: { minHeight: 64 },
  sent: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md, gap: space.xs },
  rescue: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
  },
});
