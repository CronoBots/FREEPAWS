import { router } from "expo-router";
import { View } from "react-native";

import { useAdminServices } from "@/api/admin";
import { localizeContent } from "@/api/services";
import { AdminGuard } from "@/components/admin-guard";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { useLanguage } from "@/i18n";
import { formatPrice } from "@/utils/format";

export default function AdminServicesRoute() {
  return (
    <AdminGuard>
      <AdminServices />
    </AdminGuard>
  );
}

function AdminServices() {
  const { t, language } = useLanguage();
  const services = useAdminServices();

  return (
    <Screen underHeader refreshing={services.isRefetching} onRefresh={() => void services.refetch()}>
      {services.isLoading ? (
        <LoadingView />
      ) : services.isError ? (
        <ErrorView error={services.error} onRetry={() => void services.refetch()} />
      ) : (
        <View>
          {services.data?.map((service) => {
            const localized = localizeContent(service, language);
            const detail = [
              service.booking_enabled ? t("admin.fieldBookingEnabled") : t("coaching.appointment"),
              formatPrice(service.price_cents),
              service.active ? null : "—",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListRow
                key={service.id}
                label={localized.name}
                detail={detail}
                onPress={() => router.push({ pathname: "/admin/service/[id]", params: { id: service.id } })}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
