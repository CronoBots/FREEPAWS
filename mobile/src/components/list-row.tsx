import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, space } from "@/theme";

type Props = {
  label: string;
  detail?: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ListRow({ label, detail, onPress, destructive }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <AppText variant="bodyStrong" style={destructive && styles.destructive}>
          {label}
        </AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      {!destructive ? <AppText style={styles.chevron}>›</AppText> : null}
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
  pressed: { opacity: 0.6 },
  texts: { flex: 1, gap: 2 },
  destructive: { color: colors.danger },
  chevron: { fontSize: 24, color: colors.inkSoft, paddingLeft: space.md },
});
