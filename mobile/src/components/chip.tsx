import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected, onPress, disabled, accessibilityLabel, style }: Props) {
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
        style,
      ]}
    >
      <AppText style={[styles.label, selected && styles.labelSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  // Même style que l’option choisie de Segmented : distinct d’un bouton principal plein.
  selected: {
    borderWidth: 2,
    borderColor: colors.olive,
    backgroundColor: "rgba(108, 119, 70, 0.12)",
    paddingHorizontal: space.md - 1,
    paddingVertical: space.sm - 1,
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: "center" },
  labelSelected: { fontFamily: fonts.sansSemiBold, color: colors.ink },
});
