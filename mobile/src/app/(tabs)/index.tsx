import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useParkStatus } from "@/api/park";
import { PARK_SERVICE_SLUG, useService } from "@/api/services";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { LivePanel } from "@/components/live-panel";
import { ParkStatusCard } from "@/components/park-status-card";
import { Screen } from "@/components/screen";
import { ErrorView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useCompact } from "@/hooks/use-compact";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";
import { space } from "@/theme";

// Textes repris de freepaws.be (accueil et journal-de-bord.html), traduits dans i18n/.
const STEPS = [
  { state: "park.stepDone", tone: "success", title: "park.step1Title", text: "park.step1Text" },
  { state: "park.stepDone", tone: "success", title: "park.step2Title", text: "park.step2Text" },
  { state: "park.stepInProgress", tone: "warning", title: "park.step3Title", text: "park.step3Text" },
  { state: "park.stepUpcoming", tone: "neutral", title: "park.step4Title", text: "park.step4Text" },
] as const;

export default function ParkScreen() {
  const status = useParkStatus();
  const parkService = useService(PARK_SERVICE_SLUG).data;
  const notOpen = status.data?.status === "not_open";
  const compact = useCompact();
  const { t } = useLanguage();

  return (
    <Screen refreshing={status.isRefetching} onRefresh={() => void status.refetch()}>
      <View style={styles.brand}>
        <Image
          source={require("@/assets/logo.png")}
          style={compact ? styles.logoCompact : styles.logo}
          contentFit="contain"
          accessibilityLabel={t("common.logoLabel")}
        />
        <View style={styles.brandText}>
          <AppText variant="eyebrow">{t("park.eyebrow")}</AppText>
          <AppText variant="display" accessibilityRole="header" style={compact && styles.titleCompact}>
            FreePaws Park
          </AppText>
        </View>
      </View>

      <AppText variant="body">{t("park.intro")}</AppText>

      {status.isError ? (
        <ErrorView error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <ParkStatusCard status={status.data} />
      )}

      {notOpen || !parkService?.booking_enabled ? (
        <Card>
          <AppText variant="heading">{t("park.waitlistTitle")}</AppText>
          <AppText variant="body">{t("park.waitlistText")}</AppText>
          <Button label={t("park.waitlistButton")} onPress={() => void openContactEmail(t("park.waitlistSubject"))} />
        </Card>
      ) : (
        <Button
          label={t("park.book")}
          onPress={() => router.push({ pathname: "/service/[slug]", params: { slug: PARK_SERVICE_SLUG } })}
        />
      )}

      <LivePanel status={status.data} statusFailed={status.isError} />

      {notOpen ? (
        <Card>
          <AppText variant="eyebrow">{t("park.projectTitle")}</AppText>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.step}>
              <Badge label={t(step.state)} tone={step.tone} />
              <AppText variant="bodyStrong">{t(step.title)}</AppText>
              <AppText variant="body">{t(step.text)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: 64, height: 64 },
  logoCompact: { width: 48, height: 48 },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  brandText: { flex: 1 },
  step: { gap: space.xs, paddingTop: space.sm },
});
