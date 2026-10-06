import { Screen } from "@/components/screen";
import { ServiceCard } from "@/components/service-card";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useServices } from "@/api/services";

export default function ServicesScreen() {
  const services = useServices();
  const park = services.data?.filter((service) => service.slug.startsWith("park")) ?? [];
  const coaching = services.data?.filter((service) => !service.slug.startsWith("park")) ?? [];

  return (
    <Screen
      title="Réserver"
      eyebrow="FreePaws"
      refreshing={services.isRefetching}
      onRefresh={() => void services.refetch()}
    >
      {services.isLoading ? (
        <LoadingView />
      ) : services.isError ? (
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      ) : services.data?.length === 0 ? (
        <EmptyView title="Aucune prestation pour le moment" message="Revenez bientôt." />
      ) : (
        <>
          {park.length > 0 ? <AppText variant="eyebrow">FreePaws Park</AppText> : null}
          {park.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
          {coaching.length > 0 ? <AppText variant="eyebrow">Coaching famille-chien</AppText> : null}
          {coaching.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </>
      )}
    </Screen>
  );
}
