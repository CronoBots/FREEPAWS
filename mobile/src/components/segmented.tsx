import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/chip";
import { space } from "@/theme";

type Option<T> = { value: T; label: string };

type Props<T> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Nom du groupe pour les lecteurs d’écran. */
  accessibilityLabel?: string;
};

// Largeur approximative d’un caractère du libellé (Work Sans 15 px) et marges internes d’un choix.
const CHAR_WIDTH = 8.5;
const SEGMENT_PADDING = space.sm * 2 + 8;

/**
 * Choix exclusif sur des colonnes de largeur égale. Quand la place manque, les options passent en
 * grille (2 × 2 pour 4 options) ou les unes sous les autres, jamais en 2 + 1 avec un orphelin.
 */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const longest = Math.max(...options.map((option) => option.label.length));
  const minSegment = longest * CHAR_WIDTH + SEGMENT_PADDING;
  const fits = (columns: number) => width === 0 || (width - space.sm * (columns - 1)) / columns >= minSegment;

  const count = options.length;
  const columns = fits(count) ? count : count % 2 === 0 && fits(count / 2) ? count / 2 : 1;
  const rows: Option<T>[][] = [];
  for (let index = 0; index < count; index += columns) rows.push(options.slice(index, index + columns));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.root}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((option) => (
            <Chip
              key={String(option.value)}
              label={option.label}
              selected={option.value === value}
              onPress={() => onChange(option.value)}
              style={styles.segment}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, alignSelf: "stretch" },
  row: { flexDirection: "row", gap: space.sm },
  segment: { flex: 1, flexBasis: 0, paddingHorizontal: space.sm },
});
