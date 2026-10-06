import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { type Booking, isUpcoming } from "@/api/bookings";
import { Badge } from "@/components/badge";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";
import { formatDayLong, formatTime } from "@/utils/dates";

export function bookingBadge(booking: Booking): { label: string; tone: "success" | "neutral" | "danger" } {
  if (booking.status === "cancelled") return { label: "Annulée", tone: "danger" };
  if (isUpcoming(booking)) return { label: "Confirmée", tone: "success" };
  return { label: "Passée", tone: "neutral" };
}

export function BookingCard({ booking }: { booking: Booking }) {
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
      {booking.dog ? <AppText variant="caption">Avec {booking.dog.name}</AppText> : null}
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
