import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useSettings, useUpdateSettings } from "@/api/admin";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { env } from "@/lib/env";
import { colors } from "@/theme";
import { toUserMessage } from "@/utils/errors";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const updateSettings = useUpdateSettings();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [reminder, setReminder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailValue = adminEmail ?? settings.data?.admin_email ?? "";
  const reminderValue = reminder ?? String(settings.data?.reminder_hours ?? 48);

  const saveNotifications = () => {
    setError(null);
    const email = emailValue.trim();
    if (email && !EMAIL.test(email)) return setError(t("admin.invalidEmail"));
    const hours = Number(reminderValue);
    if (!Number.isInteger(hours) || hours < 1 || hours > 336) {
      return setError(t("admin.invalidNumber", { field: t("admin.reminderHours") }));
    }
    updateSettings.mutate(
      { admin_email: email || null, reminder_hours: hours },
      { onSuccess: () => notify(t("admin.saved"), ""), onError: (err) => setError(toUserMessage(err)) },
    );
  };
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

      {settings.data ? (
        <Card>
          <AppText variant="heading">{t("admin.notifyTitle")}</AppText>
          <AppText variant="body">{t("admin.notifyText")}</AppText>
          <TextField
            label={t("admin.adminEmail")}
            value={emailValue}
            onChangeText={setAdminEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            maxLength={200}
          />
          <TextField
            label={t("admin.reminderHours")}
            value={reminderValue}
            onChangeText={(text) => setReminder(text.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={3}
          />
          {error ? (
            <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
              {error}
            </AppText>
          ) : null}
          <Button
            label={t("common.save")}
            variant="secondary"
            loading={updateSettings.isPending}
            onPress={saveNotifications}
          />
        </Card>
      ) : null}

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

const styles = StyleSheet.create({
  error: { color: colors.danger },
});
