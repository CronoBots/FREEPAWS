import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Chip } from "@/components/chip";
import { CONTENT_MAX_WIDTH } from "@/components/screen";
import { space } from "@/theme";

type Item = { key: string; label: string; accessibilityLabel?: string; selected: boolean; onPress: () => void };

/**
 * Grille régulière de créneaux : colonnes de largeur égale qui remplissent toute la ligne,
 * quel que soit l’écran (3 colonnes sur petit téléphone, jusqu’à 6 sur tablette).
 */
export function SlotGrid({ items, wide = false }: { items: Item[]; wide?: boolean }) {
  const { width } = useWindowDimensions();
  const available = Math.min(width - space.lg * 2, CONTENT_MAX_WIDTH);
  const minCell = wide ? 150 : 78;
  const columns = Math.max(1, Math.min(wide ? 3 : 6, Math.floor((available + space.sm) / (minCell + space.sm))));
  const cellWidth = (available - space.sm * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Chip
          key={item.key}
          label={item.label}
          accessibilityLabel={item.accessibilityLabel}
          selected={item.selected}
          onPress={item.onPress}
          style={{ width: cellWidth }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
