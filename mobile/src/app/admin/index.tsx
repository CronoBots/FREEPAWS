import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useSettings, useUpdateSettings } from "@/api/admin";
import { useTotpFactors } from "@/api/mfa";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { env } from "@/lib/env";
import { colors, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type HubKey =
  | "hubAgenda"
  | "hubServices"
  | "hubAvailability"
  | "hubClosures"
  | "hubDiscounts"
  | "hubDocuments"
  | "hubDashboard"
  | "hubClients"
  | "hubVaccinations"
  | "hubVaccineTypes"
  | "hubIncidents"
  | "hubParkRules"
  | "hubSecurity"
  | "hubPricing"
  | "hubCalendarDays"
  | "hubCalendarSync";

const SECTIONS: { title: TranslationKey; rows: [HubKey, Href][] }[] = [
  {
    title: "admin.sectionGeneral",
    rows: [
      ["hubAgenda", "/admin/agenda"],
      ["hubDashboard", "/admin/dashboard"],
      ["hubServices", "/admin/services"],
      ["hubPricing", "/admin/pricing"],
      ["hubCalendarDays", "/admin/calendar-days"],
      ["hubAvailability", "/admin/availability"],
      ["hubClosures", "/admin/closures"],
      ["hubDiscounts", "/admin/discounts"],
      ["hubDocuments", "/admin/documents"],
    ],
  },
  {
    title: "admin.sectionPark",
    rows: [
      ["hubClients", "/admin/clients"],
      ["hubVaccinations", "/admin/vaccinations"],
      ["hubVaccineTypes", "/admin/vaccine-types"],
      ["hubIncidents", "/admin/incidents"],
      ["hubParkRules", "/admin/park-rules"],
    ],
  },
  {
    // Réglages du compte : suivis des cartes « Notifications par email » et « Exporter mes rendez-vous ».
    title: "admin.sectionAccount",
    rows: [
      ["hubSecurity", "/admin/security"],
      ["hubCalendarSync", "/admin/calendar-sync"],
    ],
  },
];

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
  const factors = useTotpFactors();
  const mfaMissing = factors.data != null && !factors.data.some((factor) => factor.status === "verified");
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
      {mfaMissing ? (
        <Card>
          <AppText variant="bodyStrong">{t("admin.mfaBanner")}</AppText>
          <Button label={t("admin.mfaEnable")} onPress={() => router.push("/admin/security")} />
        </Card>
      ) : null}

      {/* Écran critique en cas d’accident : toujours en tête, bien distinct des autres entrées. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("admin.hubEmergency")}, ${t("admin.hubEmergencyDetail")}`}
        onPress={() => router.push("/admin/emergency")}
        style={({ pressed }) => [styles.emergency, pressed && styles.pressed]}
      >
        <Ionicons name="alert-circle" size={28} color={colors.danger} />
        <View style={styles.emergencyTexts}>
          <AppText variant="bodyStrong" style={styles.emergencyLabel}>
            {t("admin.hubEmergency")}
          </AppText>
          <AppText variant="caption">{t("admin.hubEmergencyDetail")}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.danger} />
      </Pressable>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="heading">{t(section.title)}</AppText>
          <View>
            {section.rows.map(([key, href], index) => (
              <ListRow
                key={key}
                label={t(`admin.${key}`)}
                detail={t(`admin.${key}Detail`)}
                onPress={() => router.push(href)}
                last={index === section.rows.length - 1}
              />
            ))}
          </View>
        </View>
      ))}

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
          <Button label={t("common.save")} loading={updateSettings.isPending} onPress={saveNotifications} />
        </Card>
      ) : null}

      {feedUrl ? (
        <Card>
          <AppText variant="heading">{t("admin.hubCalendar")}</AppText>
          {/* Le lien contient un jeton secret : on ne l’affiche pas, le bouton suffit pour le copier. */}
          <AppText variant="body">{t("admin.calendarText")}</AppText>
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
  section: { gap: space.sm },
  error: { color: colors.danger },
  emergency: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: colors.white,
  },
  emergencyTexts: { flex: 1, gap: 2 },
  emergencyLabel: { color: colors.danger },
  pressed: { opacity: 0.7 },
});
