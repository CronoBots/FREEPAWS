import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

type Props = { label: string; checked: boolean; onChange: (checked: boolean) => void };

export function Checkbox({ label, checked, onChange }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <AppText style={styles.tick}>✓</AppText> : null}
      </View>
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md, minHeight: 44, paddingVertical: space.xs },
  pressed: { opacity: 0.7 },
  box: {
    width: 26,
    height: 26,
    marginTop: 1,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.ink },
  tick: { color: colors.cream, fontSize: 16, lineHeight: 20, fontWeight: "700" },
  label: { flex: 1 },
});
