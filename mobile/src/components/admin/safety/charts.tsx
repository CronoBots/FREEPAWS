import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

/** Chiffre clé du tableau de bord (deux par ligne, une seule colonne sur très petit écran). */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="title" style={styles.tileValue}>
        {value}
      </AppText>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}

/** Barre de progression horizontale (0 à 1). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const ratio = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

export type Bar = { key: string; label: string; count: number };

/**
 * Histogramme horizontal : longueur et intensité de la couleur proportionnelles au nombre,
 * pour repérer les tranches pleines et creuses sans seuil arbitraire.
 */
export function BarList({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));
  return (
    <View style={styles.list}>
      {bars.map((bar) => {
        const ratio = bar.count / max;
        return (
          <View key={bar.key} style={styles.row} accessible accessibilityLabel={`${bar.label}: ${bar.count}`}>
            <AppText variant="caption" style={styles.rowLabel} numberOfLines={1}>
              {bar.label}
            </AppText>
            <View style={styles.rowTrack}>
              {bar.count > 0 ? (
                <View
                  style={[styles.rowFill, { width: `${Math.max(ratio * 100, 3)}%`, opacity: 0.25 + 0.75 * ratio }]}
                />
              ) : null}
            </View>
            <AppText variant="caption" style={styles.rowCount}>
              {bar.count}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 130,
    minWidth: 0,
    backgroundColor: colors.creamAlt,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    gap: space.xs,
  },
  tileValue: { fontSize: 22, lineHeight: 28 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.closedSoft, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.olive },
  list: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 24 },
  rowLabel: { width: 52 },
  rowTrack: { flex: 1, height: 14, borderRadius: radius.sm, backgroundColor: colors.closedSoft, overflow: "hidden" },
  rowFill: { height: "100%", borderRadius: radius.sm, backgroundColor: colors.olive },
  rowCount: { minWidth: 28, textAlign: "right", fontVariant: ["tabular-nums"] },
});
