import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { View } from "react-native";

import { useSettings } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { env } from "@/lib/env";

export default function AdminHubRoute() {
  return (
    <AdminGuard>
      <AdminHub />
    </AdminGuard>
  );
}

function AdminHub() {
  const { t } = useLanguage();
  const settings = useSettings();
  const feedUrl = settings.data
    ? `${env.supabaseUrl}/functions/v1/calendar-feed?token=${settings.data.calendar_token}`
    : null;

  return (
    <Screen underHeader>
      <View>
        <ListRow
          label={t("admin.hubAgenda")}
          detail={t("admin.hubAgendaDetail")}
          onPress={() => router.push("/admin/agenda")}
        />
        <ListRow
          label={t("admin.hubServices")}
          detail={t("admin.hubServicesDetail")}
          onPress={() => router.push("/admin/services")}
        />
        <ListRow
          label={t("admin.hubAvailability")}
          detail={t("admin.hubAvailabilityDetail")}
          onPress={() => router.push("/admin/availability")}
        />
        <ListRow
          label={t("admin.hubClosures")}
          detail={t("admin.hubClosuresDetail")}
          onPress={() => router.push("/admin/closures")}
        />
        <ListRow
          label={t("admin.hubDiscounts")}
          detail={t("admin.hubDiscountsDetail")}
          onPress={() => router.push("/admin/discounts")}
        />
        <ListRow
          label={t("admin.hubDocuments")}
          detail={t("admin.hubDocumentsDetail")}
          onPress={() => router.push("/admin/documents")}
        />
      </View>

      {feedUrl ? (
        <Card>
          <AppText variant="heading">{t("admin.hubCalendar")}</AppText>
          <AppText variant="body">{t("admin.calendarText")}</AppText>
          <AppText variant="caption" selectable>
            {feedUrl}
          </AppText>
          <Button
            label={t("admin.copyLink")}
            variant="secondary"
            onPress={() => void Clipboard.setStringAsync(feedUrl).then(() => notify(t("admin.linkCopied"), ""))}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
