import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, fonts, space } from "@/theme";

/**
 * Retour de secours quand l’écran est ouvert directement (lien d’un e-mail, actualisation sur le web) :
 * il n’y a alors pas d’historique et l’en-tête n’aurait aucun bouton retour.
 */
export function HeaderHome({ admin }: { admin: boolean }) {
  const { t } = useLanguage();
  const label = admin ? t("titles.admin") : t("common.home");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => router.replace(admin ? "/admin" : "/")}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={22} color={colors.ink} />
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.6 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink },
});
