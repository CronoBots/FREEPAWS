import { useLocalSearchParams } from "expo-router";

import { useService } from "@/api/services";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { useLanguage } from "@/i18n";
import { ServiceBooking } from "@/screens/service-booking";
import { ServiceInfo } from "@/screens/service-info";

export default function ServiceRoute() {
  const { t } = useLanguage();
  const { slug, reschedule } = useLocalSearchParams<{ slug: string; reschedule?: string }>();
  const service = useService(slug);

  if (service.data) {
    return service.data.booking_enabled ? (
      <ServiceBooking service={service.data} rescheduleBookingId={reschedule} />
    ) : (
      <ServiceInfo service={service.data} />
    );
  }
  return (
    <Screen underHeader>
      {service.isLoading ? (
        <LoadingView />
      ) : service.isError ? (
        <ErrorView error={service.error} onRetry={() => void service.refetch()} />
      ) : (
        <EmptyView title={t("notFound.service")} message={t("notFound.serviceText")} />
      )}
    </Screen>
  );
}
