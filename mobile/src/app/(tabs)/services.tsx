import { PARK_SERVICE_SLUG, useServices } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { ServiceCard } from "@/components/service-card";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";

// Textes repris de freepaws.be/coaching.html.
export default function ServicesScreen() {
  const { t } = useLanguage();
  const services = useServices();
  // Le parc a son propre onglet.
  const coaching = services.data?.filter((service) => service.slug !== PARK_SERVICE_SLUG) ?? [];

  return (
    <Screen
      title={t("tabs.coaching")}
      eyebrow={t("coaching.eyebrow")}
      refreshing={services.isRefetching}
      onRefresh={() => void services.refetch()}
    >
      <AppText variant="body">{t("coaching.intro")}</AppText>

      {services.isLoading ? (
        <LoadingView />
      ) : services.isError ? (
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      ) : coaching.length === 0 ? (
        <EmptyView title={t("coaching.empty")} />
      ) : (
        coaching.map((service) => <ServiceCard key={service.id} service={service} />)
      )}

      <Card>
        <AppText variant="heading">{t("coaching.ctaTitle")}</AppText>
        <AppText variant="body">{t("coaching.ctaText")}</AppText>
        <Button label={t("coaching.appointment")} onPress={() => void openContactEmail(t("coaching.appointment"))} />
      </Card>
    </Screen>
  );
}
