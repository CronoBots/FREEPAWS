import { StyleSheet, View } from "react-native";

import type { ParkStatus } from "@/api/park";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { colors, space } from "@/theme";
import { formatTime } from "@/utils/dates";

const COPY = {
  free: { label: "Libre", color: colors.free, until: "jusqu'à" },
  reserved: { label: "Réservé", color: colors.reserved, until: "jusqu'à" },
  closed: { label: "Fermé", color: colors.closed, until: "jusqu'à" },
  not_open: { label: "Pas encore ouvert", color: colors.reserved, until: "" },
} as const;

export function ParkStatusCard({ status }: { status: ParkStatus | undefined }) {
  const copy = status ? COPY[status.status] : null;
  const detail = !status
    ? "Statut en cours de chargement…"
    : status.status === "not_open"
      ? "Projet actif, recherche de terrain en cours."
      : status.status === "free"
        ? status.until
          ? `Disponible maintenant, jusqu'à ${formatTime(status.until)}.`
          : "Disponible maintenant."
        : status.status === "reserved"
          ? `Session privée en cours${status.until ? `, jusqu'à ${formatTime(status.until)}` : ""}.`
          : status.until
            ? `Fermé jusqu'à ${formatTime(status.until)}.`
            : "En dehors des heures d'ouverture.";

  return (
    <Card accessibilityRole="summary" accessibilityLabel={`Parc ${copy?.label ?? ""}. ${detail}`}>
      <AppText variant="eyebrow">{status?.status === "not_open" ? "FreePaws Park" : "En ce moment"}</AppText>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: copy?.color ?? colors.line }]} />
        <AppText variant="title">{copy?.label ?? "…"}</AppText>
      </View>
      <AppText variant="body">{detail}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
