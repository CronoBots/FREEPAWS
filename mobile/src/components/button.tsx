import * as Haptics from "expo-haptics";
import { ActivityIndicator, Platform, Pressable, type PressableProps, StyleSheet, Text } from "react-native";

import { colors, fonts, radius, space } from "@/theme";

/** dangerText : action destructrice secondaire (Supprimer), texte rouge sans fond. */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerText";

type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ label, variant = "primary", loading = false, disabled, onPress, style, ...props }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive), busy: loading }}
      disabled={inactive}
      onPress={(event) => {
        if (Platform.OS !== "web") void Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && styles.pressed,
        inactive && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.cream : colors.ink} />
      ) : (
        <Text
          style={[
            styles.label,
            (variant === "primary" || variant === "danger") && styles.labelInverse,
            variant === "dangerText" && styles.labelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.creamAlt, borderWidth: 1, borderColor: colors.ink },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  dangerText: { backgroundColor: "transparent" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 21, color: colors.ink, textAlign: "center" },
  labelInverse: { color: colors.cream },
  labelDanger: { color: colors.danger },
});
