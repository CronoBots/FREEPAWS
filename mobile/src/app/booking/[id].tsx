import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { canCancel, useBooking, useCancelBooking } from "@/api/bookings";
import { Badge } from "@/components/badge";
import { bookingBadge } from "@/components/booking-card";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDayLong, formatTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function BookingRoute() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const booking = useBooking(id);
  const cancel = useCancelBooking();

  if (booking.isLoading)
    return (
      <Screen underHeader>
        <LoadingView />
      </Screen>
    );
  if (booking.isError) {
    return (
      <Screen underHeader>
        <ErrorView error={booking.error} onRetry={() => void booking.refetch()} />
      </Screen>
    );
  }
  const data = booking.data;
  if (!data) {
    return (
      <Screen underHeader>
        <EmptyView
          title="Réservation introuvable"
          actionLabel="Mes réservations"
          onAction={() => router.navigate("/bookings")}
        />
      </Screen>
    );
  }

  const badge = bookingBadge(data);
  const cancellable = canCancel(data);

  const onCancel = async () => {
    const ok = await confirm({
      title: "Annuler cette réservation ?",
      message: `${data.service.name}, ${formatDayLong(data.start)} à ${formatTime(data.start)}.`,
      confirmLabel: "Annuler la réservation",
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(data.id, {
      onSuccess: () => void booking.refetch(),
      onError: (error) => notify("Annulation impossible", toUserMessage(error)),
    });
  };

  return (
    <Screen underHeader>
      {created === "1" && data.status === "confirmed" ? (
        <View style={styles.success} accessibilityRole="alert">
          <AppText variant="heading" style={styles.successText}>
            C’est réservé !
          </AppText>
          <AppText variant="body" style={styles.successText}>
            Vous retrouverez cette réservation dans l’onglet « Mes réservations ».
          </AppText>
        </View>
      ) : null}

      <Card>
        <Badge label={badge.label} tone={badge.tone} />
        <AppText variant="title">{data.service.name}</AppText>
        <AppText variant="bodyStrong">{formatDayLong(data.start)}</AppText>
        <AppText variant="body">
          {formatTime(data.start)} –⁠ {formatTime(data.end)}
        </AppText>
        {data.service.location ? <AppText variant="body">{data.service.location}</AppText> : null}
        {data.dog ? <AppText variant="body">Avec {data.dog.name}</AppText> : null}
        {data.client_notes ? <AppText variant="caption">« {data.client_notes} »</AppText> : null}
      </Card>

      {data.status === "confirmed" ? (
        cancellable ? (
          <Button
            label="Annuler la réservation"
            variant="secondary"
            loading={cancel.isPending}
            onPress={() => void onCancel()}
          />
        ) : data.start > new Date() ? (
          <AppText variant="caption">
            Le délai d’annulation en ligne ({data.service.cancel_notice_hours} h) est dépassé : contactez-nous
            directement.
          </AppText>
        ) : null
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { backgroundColor: colors.freeSoft, borderRadius: 18, padding: space.lg, gap: space.xs },
  successText: { color: colors.free },
});
