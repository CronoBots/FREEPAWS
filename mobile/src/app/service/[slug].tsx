import { useLocalSearchParams } from "expo-router";

import { useService } from "@/api/services";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { ServiceBooking } from "@/screens/service-booking";

export default function ServiceRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const service = useService(slug);

  if (service.data) return <ServiceBooking service={service.data} />;
  return (
    <Screen underHeader>
      {service.isLoading ? (
        <LoadingView />
      ) : service.isError ? (
        <ErrorView error={service.error} onRetry={() => void service.refetch()} />
      ) : (
        <EmptyView title="Prestation introuvable" message="Elle n'est peut-être plus proposée." />
      )}
    </Screen>
  );
}
