import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useParkStatus } from "@/api/park";
import { PARK_SERVICE_SLUG } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { LivePanel } from "@/components/live-panel";
import { ParkStatusCard } from "@/components/park-status-card";
import { Screen } from "@/components/screen";
import { ErrorView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { space } from "@/theme";

export default function ParkScreen() {
  const status = useParkStatus();

  return (
    <Screen refreshing={status.isRefetching} onRefresh={() => void status.refetch()}>
      <View style={styles.brand}>
        <Image
          source={require("@/assets/logo.png")}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Logo FreePaws"
        />
        <View style={styles.brandText}>
          <AppText variant="eyebrow">Liège · Huy · Waremme</AppText>
          <AppText variant="display" accessibilityRole="header">
            FreePaws Park
          </AppText>
        </View>
      </View>

      <AppText variant="body">
        Un terrain clôturé et sécurisé pour que votre chien puisse courir, jouer et se dépenser librement.
      </AppText>

      {status.isError ? (
        <ErrorView error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <ParkStatusCard status={status.data} />
      )}

      <Button
        label="Réserver une session au parc"
        onPress={() => router.push({ pathname: "/service/[slug]", params: { slug: PARK_SERVICE_SLUG } })}
      />

      <LivePanel status={status.data} statusFailed={status.isError} />

      <Card>
        <AppText variant="eyebrow">Comment ça marche</AppText>
        <Step n="1" text="Vérifiez en direct si le parc est libre et l'état du terrain." />
        <Step n="2" text="Réservez votre créneau : le parc est à vous seul pendant la session." />
        <Step n="3" text="Pendant votre session, la caméra devient privée — gardez un œil sur votre chien." />
      </Card>
    </Screen>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <AppText variant="heading" style={styles.stepNumber}>
        {n}
      </AppText>
      <AppText variant="body" style={styles.stepText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: 64, height: 64 },
  brandText: { flex: 1 },
  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepNumber: { width: 20 },
  stepText: { flex: 1 },
});
