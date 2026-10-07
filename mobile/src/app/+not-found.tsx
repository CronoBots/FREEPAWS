import { router, Stack } from "expo-router";

import { Screen } from "@/components/screen";
import { EmptyView } from "@/components/state-views";
import { useLanguage } from "@/i18n";

export default function NotFoundRoute() {
  const { t } = useLanguage();
  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: t("titles.notFound") }} />
      <EmptyView title={t("notFound.title")} actionLabel={t("notFound.home")} onAction={() => router.replace("/")} />
    </Screen>
  );
}
