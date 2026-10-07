import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { useAdminServices } from "@/api/admin";
import { pricingKeys } from "@/api/pricing";
import { localizeContent } from "@/api/services";
import { AdminGuard } from "@/components/admin-guard";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/utils/format";

export default function AdminPricingRoute() {
  return (
    <AdminGuard>
      <Pricing />
    </AdminGuard>
  );
}

/** Nombre de règles par prestation (invalidé avec les règles : même préfixe de clé). */
function useRuleCounts() {
  return useQuery({
    queryKey: [...pricingKeys.allRules, "counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_rules").select("service_id");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) counts.set(row.service_id, (counts.get(row.service_id) ?? 0) + 1);
      return counts;
    },
  });
}

function Pricing() {
  const { t, tp, language } = useLanguage();
  const services = useAdminServices();
  const counts = useRuleCounts();

  return (
    <Screen
      underHeader
      refreshing={services.isRefetching || counts.isRefetching}
      onRefresh={() => {
        void services.refetch();
        void counts.refetch();
      }}
    >
      <Card>
        <AppText variant="body">{t("pricing.intro")}</AppText>
        <AppText variant="bodyStrong">{t("pricing.orderTitle")}</AppText>
        <View>
          {(["pricing.orderStep1", "pricing.orderStep2", "pricing.orderStep3"] as const).map((key) => (
            <AppText key={key} variant="body">
              {t(key)}
            </AppText>
          ))}
        </View>
        <AppText variant="body">{t("pricing.orderLast")}</AppText>
      </Card>

      <Card>
        <ListRow
          label={t("admin.hubCalendarDays")}
          detail={t("admin.hubCalendarDaysDetail")}
          last
          onPress={() => router.push("/admin/calendar-days")}
        />
      </Card>

      {services.isLoading ? (
        <LoadingView />
      ) : services.isError ? (
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      ) : (services.data ?? []).length === 0 ? (
        <EmptyView title={t("pricing.noServices")} />
      ) : (
        <Card>
          {services.data?.map((service, index, list) => (
            <ListRow
              key={service.id}
              last={index === list.length - 1}
              label={localizeContent(service, language).name}
              detail={[
                formatPrice(service.price_cents) ?? t("pricing.noPrice"),
                counts.data ? tp("pricing.ruleCount", counts.data.get(service.id) ?? 0) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => router.push({ pathname: "/admin/pricing/[serviceId]", params: { serviceId: service.id } })}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
