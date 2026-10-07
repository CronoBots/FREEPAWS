import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { type Booking, isUpcoming } from "@/api/bookings";
import { Badge } from "@/components/badge";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";
import { formatDayLong, formatTime } from "@/utils/dates";
import { t, tp, useLanguage } from "@/i18n";

export function bookingBadge(booking: Booking): { label: string; tone: "success" | "neutral" | "danger" } {
  if (booking.status === "cancelled") return { label: t("booking.badgeCancelled"), tone: "danger" };
  if (isUpcoming(booking)) return { label: t("booking.badgeConfirmed"), tone: "success" };
  return { label: t("booking.badgePast"), tone: "neutral" };
}

export function BookingCard({ booking }: { booking: Booking }) {
  useLanguage();
  const badge = bookingBadge(booking);
  const when = `${formatDayLong(booking.start)}, ${formatTime(booking.start)} –⁠ ${formatTime(booking.end)}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
      accessibilityRole="link"
      accessibilityLabel={`${booking.service.name}, ${when}, ${badge.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Badge label={badge.label} tone={badge.tone} />
      <AppText variant="heading">{booking.service.name}</AppText>
      <AppText variant="body">{when}</AppText>
      {(booking.dogs_count ?? 0) > 1 ? (
        // Plusieurs chiens (parc) : le nom d’un seul serait trompeur, on donne le nombre.
        <AppText variant="caption">{tp("booking.peopleDogs", booking.dogs_count ?? 0)}</AppText>
      ) : booking.dog ? (
        <AppText variant="caption">{t("common.with", { name: booking.dog.name })}</AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamAlt,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.xs,
  },
  pressed: { opacity: 0.8 },
});
