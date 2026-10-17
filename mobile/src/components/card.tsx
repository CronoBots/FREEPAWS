import { StyleSheet, View, type ViewProps } from "react-native";

import { Tick } from "@/components/spine";
import { colors, radius, space } from "@/theme";

type Props = ViewProps & {
  /** Carte qui ouvre une section : trait laiton sur la colonne vertébrale (texte = repère sur grand écran). */
  tick?: boolean | string;
};

export function Card({ style, tick, ...props }: Props) {
  const card = <View {...props} style={[styles.card, style]} />;
  if (!tick) return card;
  return (
    <Tick label={typeof tick === "string" ? tick : undefined} offset={space.lg + 9}>
      {card}
    </Tick>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
  },
});
