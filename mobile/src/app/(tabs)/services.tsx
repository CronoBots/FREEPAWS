import { useServices } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { ServiceCard } from "@/components/service-card";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { openContactEmail } from "@/lib/contact";

// Textes repris de freepaws.be/coaching.html.
export default function ServicesScreen() {
  const services = useServices();

  return (
    <Screen
      title="Coaching"
      eyebrow="Cohabitation famille-chien"
      refreshing={services.isRefetching}
      onRefresh={() => void services.refetch()}
    >
      <AppText variant="body">
        Un accompagnement pensé pour que votre chien et votre famille trouvent leur équilibre — dès l’adoption, ou pour
        apaiser une cohabitation devenue difficile.
      </AppText>

      {services.isLoading ? (
        <LoadingView />
      ) : services.isError ? (
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      ) : services.data?.length === 0 ? (
        <EmptyView title="Aucune prestation pour le moment" />
      ) : (
        services.data?.map((service) => <ServiceCard key={service.id} service={service} />)
      )}

      <Card>
        <AppText variant="heading">Prête à en parler ?</AppText>
        <AppText variant="body">
          Chaque situation est différente — le plus simple est d’en discuter directement pour voir quel accompagnement
          correspond à votre famille.
        </AppText>
        <Button label="Prendre rendez-vous" onPress={() => void openContactEmail("Prendre rendez-vous")} />
      </Card>
    </Screen>
  );
}
