import { PARK_SERVICE_SLUG, useServices } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { Tick } from "@/components/spine";
import { ServiceCard } from "@/components/service-card";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";
import { space } from "@/theme";

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
      tickLabel="FR—06"
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
        // Une section par prestation, numérotée comme sur coaching.html (01, 02, 03…).
        coaching.map((service, index) => (
          <Tick key={service.id} label={String(index + 1).padStart(2, "0")} offset={space.lg + 9}>
            <ServiceCard service={service} />
          </Tick>
        ))
      )}

      <Card tick>
        <AppText variant="heading">{t("coaching.ctaTitle")}</AppText>
        <AppText variant="body">{t("coaching.ctaText")}</AppText>
        <Button label={t("coaching.appointment")} onPress={() => void openContactEmail(t("coaching.appointment"))} />
      </Card>
    </Screen>
  );
}
