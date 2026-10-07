import { router } from "expo-router";

import { isUpcoming, useMyBookings } from "@/api/bookings";
import { BookingCard } from "@/components/booking-card";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";

export default function BookingsScreen() {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const bookings = useMyBookings();

  if (!userId) {
    return (
      <Screen title={t("tabs.bookings")}>
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t("booking.signInTitle")}
          </AppText>
          <AppText variant="body">{t("booking.signInText")}</AppText>
          <Button label={t("booking.signIn")} onPress={() => router.push("/sign-in")} />
        </Card>
      </Screen>
    );
  }

  const upcoming = bookings.data?.filter((booking) => isUpcoming(booking)) ?? [];
  const past = (bookings.data?.filter((booking) => !isUpcoming(booking)) ?? []).reverse();

  return (
    <Screen title={t("tabs.bookings")} refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()}>
      {bookings.isLoading ? (
        <LoadingView />
      ) : bookings.isError ? (
        <ErrorView error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : bookings.data?.length === 0 ? (
        <EmptyView
          title={t("booking.emptyTitle")}
          message={t("booking.emptyText")}
          actionLabel={t("booking.seeCoaching")}
          onAction={() => router.navigate("/services")}
        />
      ) : (
        <>
          <AppText variant="eyebrow">{t("booking.upcoming")}</AppText>
          {upcoming.length === 0 ? <AppText variant="body">{t("booking.noUpcoming")}</AppText> : null}
          {upcoming.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
          {past.length > 0 ? <AppText variant="eyebrow">{t("booking.history")}</AppText> : null}
          {past.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </>
      )}
    </Screen>
  );
}
