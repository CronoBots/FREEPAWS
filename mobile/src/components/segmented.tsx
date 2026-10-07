import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Option<T> = { value: T; label: string };

type Props<T> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Nom du groupe pour les lecteurs d’écran. */
  accessibilityLabel?: string;
};

// Largeurs moyennes des caractères en Work Sans Medium 15 px : étroits, larges et courants.
const NARROW = /[iljtfr.,:;'’!|()\s]/;
const WIDE = /[mwMW@%]/;
const UPPER = /[A-ZÀ-Ý0-9]/;
const SELECTED_BORDER = 2;
// Marges internes, contour de l’option choisie et un peu de jeu (le libellé choisi passe en semi-gras).
const SEGMENT_PADDING = space.sm * 2 + SELECTED_BORDER * 2 + 6;

/** Estimation de la largeur d’un libellé, sans mesure réelle (suffisante pour choisir la grille). */
function labelWidth(label: string) {
  let width = 0;
  for (const char of label) {
    if (NARROW.test(char)) width += 4.5;
    else if (WIDE.test(char)) width += 12.5;
    else if (UPPER.test(char)) width += 9.5;
    else width += 8;
  }
  return width;
}

/** Nombres de colonnes possibles, du plus large au plus étroit, sans ligne incomplète (pas de 2 + 1). */
function columnCandidates(count: number) {
  const candidates: number[] = [];
  for (let columns = count; columns >= 1; columns -= 1) if (count % columns === 0) candidates.push(columns);
  return candidates;
}

/**
 * Choix exclusif sur des colonnes de largeur égale. Les options tiennent sur une ligne quand c’est
 * possible ; sinon elles passent en grille régulière (2 × 2 pour 4 options), puis les unes sous les
 * autres, jamais en 2 + 1 avec un orphelin. L’option choisie a un contour épais et un fond olive clair,
 * pour ne pas ressembler au bouton principal de l’écran.
 */
export function Segmented<T extends string | number>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const minSegment = Math.max(...options.map((option) => labelWidth(option.label))) + SEGMENT_PADDING;
  const fits = (columns: number) => width === 0 || (width - space.sm * (columns - 1)) / columns >= minSegment;

  const columns = columnCandidates(options.length).find(fits) ?? 1;
  const rows: Option<T>[][] = [];
  for (let index = 0; index < options.length; index += columns) rows.push(options.slice(index, index + columns));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.root}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={String(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected, selected }}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => [styles.segment, selected && styles.selected, pressed && styles.pressed]}
              >
                <AppText style={[styles.label, selected && styles.labelSelected]}>{option.label}</AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, alignSelf: "stretch" },
  row: { flexDirection: "row", gap: space.sm },
  segment: {
    flex: 1,
    flexBasis: 0,
    minHeight: 44,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  // Contour olive épais + fond olive très clair : un état, pas une action.
  selected: { borderWidth: SELECTED_BORDER, borderColor: colors.olive, backgroundColor: "rgba(108, 119, 70, 0.12)" },
  pressed: { opacity: 0.75 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: "center" },
  labelSelected: { fontFamily: fonts.sansSemiBold },
});
