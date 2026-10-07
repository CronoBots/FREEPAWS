import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, space } from "@/theme";

type Props = {
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
  /** Dernière ligne d’une carte : pas de filet en dessous. */
  last?: boolean;
  /** false pour une ligne qui déclenche une action au lieu d’ouvrir un écran (ex. Se déconnecter). */
  chevron?: boolean;
  /** Ouvre une autre application (e-mail, navigateur) : icône de lien externe au lieu de la flèche. */
  external?: boolean;
  /** Complément lu par les lecteurs d’écran (ex. « s’ouvre hors de l’application »). */
  accessibilityHint?: string;
};

export function ListRow({
  label,
  detail,
  onPress,
  destructive,
  last,
  chevron = true,
  external,
  accessibilityHint,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <AppText variant="bodyStrong" style={destructive && styles.destructive}>
          {label}
        </AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      {destructive ? null : external ? (
        <Ionicons name="open-outline" size={18} color={colors.inkSoft} style={styles.external} />
      ) : chevron ? (
        <AppText style={styles.chevron}>›</AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  texts: { flex: 1, gap: 2 },
  destructive: { color: colors.danger },
  chevron: { fontSize: 24, color: colors.inkSoft, paddingLeft: space.md },
  external: { paddingLeft: space.md },
});
