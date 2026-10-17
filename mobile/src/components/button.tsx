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
  // Bouton plein désactivé : fond gris clair et texte foncé (lisible), plutôt qu’un bouton délavé.
  const filled = variant === "primary" || variant === "danger";
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
        // Survol / appui comme sur le site : bouton plein → olive, bouton contour → plein encre.
        isActive(state) && !inactive && variant === "primary" && styles.primaryActive,
        isActive(state) && !inactive && variant === "secondary" && styles.secondaryActive,
        state.pressed && variant !== "primary" && variant !== "secondary" && styles.pressed,
        inactive && (filled && !loading ? styles.disabledFilled : styles.disabled),
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {(state) =>
        loading ? (
          <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.cream : colors.ink} />
        ) : (
          <Text
            style={[
              styles.label,
              filled && !(disabled && !loading) && styles.labelInverse,
              filled && disabled && !loading && styles.labelDisabled,
              variant === "dangerText" && styles.labelDanger,
              variant === "ghost" && styles.labelLink,
              variant === "secondary" && isActive(state) && !inactive && styles.labelInverse,
            ]}
          >
            {label}
          </Text>
        )
      }
    </Pressable>
  );
}

// « hovered » n’existe que sur le web (react-native-web).
function isActive(state: { pressed: boolean; hovered?: boolean }) {
  return state.pressed || Boolean(state.hovered);
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 26,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  // .btn et .btn.ghost du site.
  primary: { backgroundColor: colors.ink },
  primaryActive: { backgroundColor: colors.olive },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.ink },
  secondaryActive: { backgroundColor: colors.ink },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  dangerText: { backgroundColor: "transparent" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  disabledFilled: { backgroundColor: colors.closedSoft },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.15,
    color: colors.ink,
    textAlign: "center",
  },
  // .link-inline du site : texte encre souligné d’un filet olive.
  labelLink: { textDecorationLine: "underline", textDecorationColor: colors.olive },
  labelInverse: { color: colors.cream },
  labelDanger: { color: colors.danger },
  labelDisabled: { color: colors.inkSoft },
});
