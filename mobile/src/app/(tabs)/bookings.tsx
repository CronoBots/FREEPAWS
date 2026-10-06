import { router } from "expo-router";

import { isUpcoming, useMyBookings } from "@/api/bookings";
import { BookingCard } from "@/components/booking-card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useAuth } from "@/lib/auth";

export default function BookingsScreen() {
  const { userId } = useAuth();
  const bookings = useMyBookings();

  if (!userId) {
    return (
      <Screen title="Mes réservations">
        <EmptyView
          title="Connectez-vous"
          message="Retrouvez ici vos sessions au parc et vos rendez-vous de coaching."
          actionLabel="Se connecter"
          onAction={() => router.push("/sign-in")}
        />
      </Screen>
    );
  }

  const upcoming = bookings.data?.filter((booking) => isUpcoming(booking)) ?? [];
  const past = (bookings.data?.filter((booking) => !isUpcoming(booking)) ?? []).reverse();

  return (
    <Screen title="Mes réservations" refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()}>
      {bookings.isLoading ? (
        <LoadingView />
      ) : bookings.isError ? (
        <ErrorView error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : bookings.data?.length === 0 ? (
        <EmptyView
          title="Aucune réservation"
          message="Réservez une session au parc ou un rendez-vous de coaching."
          actionLabel="Voir les prestations"
          onAction={() => router.navigate("/services")}
        />
      ) : (
        <>
          <AppText variant="eyebrow">À venir</AppText>
          {upcoming.length === 0 ? <AppText variant="body">Aucune réservation à venir.</AppText> : null}
          {upcoming.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
          {past.length > 0 ? <AppText variant="eyebrow">Historique</AppText> : null}
          {past.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </>
      )}
    </Screen>
  );
}
