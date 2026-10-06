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
import { openContactEmail } from "@/lib/contact";
import { space } from "@/theme";

// Textes repris de freepaws.be (accueil et journal-de-bord.html).
const STEPS: { state: string; tone: "success" | "warning" | "neutral"; title: string; text: string }[] = [
  {
    state: "Fait",
    tone: "success",
    title: "Formation",
    text: "Accompagnement avec Alpi (SAACE) pour structurer le business plan et le plan financier — finalisation prévue en septembre.",
  },
  {
    state: "Fait",
    tone: "success",
    title: "Communauté",
    text: "Plus de 110 réponses à l’enquête menée auprès de propriétaires de chiens de la région, et une communauté grandissante sur les réseaux sociaux.",
  },
  {
    state: "En cours",
    tone: "warning",
    title: "Recherche du terrain",
    text: "L’étape la plus longue : entre les contraintes d’urbanisme wallonnes (CoDT) et le choix du bon lieu sur l’axe Liège–Huy–Waremme, je prends le temps de bien faire les choses.",
  },
  {
    state: "À venir",
    tone: "neutral",
    title: "Ouverture",
    text: "Réservation en ligne et accès par caméra en direct, pour savoir à tout moment si le parc est libre.",
  },
];

export default function ParkScreen() {
  const status = useParkStatus();
  const parkService = useService(PARK_SERVICE_SLUG).data;
  const notOpen = status.data?.status === "not_open";

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
          <AppText variant="eyebrow">Un espace de liberté</AppText>
          <AppText variant="display" accessibilityRole="header">
            FreePaws Park
          </AppText>
        </View>
      </View>

      <AppText variant="body">
        Un lieu pensé pour que votre chien puisse enfin courir, jouer et se dépenser librement et en sécurité, entre
        Liège, Huy et Waremme.
      </AppText>

      {status.isError ? (
        <ErrorView error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <ParkStatusCard status={status.data} />
      )}

      {notOpen || !parkService?.booking_enabled ? (
        <Card>
          <AppText variant="heading">Être tenu·e informé·e de l’ouverture</AppText>
          <AppText variant="body">
            Laissez votre email pour suivre l’avancée du projet et être prévenu·e dès que le terrain sera trouvé et le
            parc en préparation.
          </AppText>
          <Button
            label="Rejoindre la liste d’attente"
            onPress={() => void openContactEmail("Liste d’attente FreePaws Park")}
          />
        </Card>
      ) : (
        <Button
          label="Réserver le parc"
          onPress={() => router.push({ pathname: "/service/[slug]", params: { slug: PARK_SERVICE_SLUG } })}
        />
      )}

      <LivePanel status={status.data} statusFailed={status.isError} />

      {notOpen ? (
        <Card>
          <AppText variant="eyebrow">Où en est le projet</AppText>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.step}>
              <Badge label={step.state} tone={step.tone} />
              <AppText variant="bodyStrong">{step.title}</AppText>
              <AppText variant="body">{step.text}</AppText>
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
  brandText: { flex: 1 },
  step: { gap: space.xs, paddingTop: space.sm },
});
