import { Pressable, StyleSheet } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Props = { label: string; selected: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string };

export function Chip({ label, selected, onPress, disabled, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <AppText style={[styles.label, selected && styles.labelSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
  labelSelected: { color: colors.cream },
});
