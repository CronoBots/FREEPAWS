import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";

/** Numéro composable (chiffres et « + »), vide s’il n’y a rien à appeler. */
function dialable(phone: string | null | undefined) {
  return phone?.replace(/[^\d+]/g, "") ?? "";
}

/**
 * Pastille d’appel (tel:), seul bouton d’appel de l’administration : fiche client, fiche réservation,
 * urgence. Rien n’est affiché sans numéro.
 */
export function CallButton({ name, phone }: { name: string; phone: string | null | undefined }) {
  const { t } = useLanguage();
  const number = dialable(phone);
  if (!number) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("adminSafety.callPerson", { name })}
      onPress={() => void Linking.openURL(`tel:${number}`).catch(() => undefined)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="call" size={22} color={colors.white} />
    </Pressable>
  );
}

/** Ligne « nom + numéro » avec la pastille d’appel. Sans numéro, le signale simplement. */
export function CallRow({
  name,
  phone,
  caption,
  style,
}: {
  name: string;
  phone: string | null;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useLanguage();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.texts}>
        {caption ? <AppText variant="caption">{caption}</AppText> : null}
        <AppText variant="bodyStrong">{name}</AppText>
        <AppText variant="caption" selectable>
          {phone || t("adminSafety.noPhone")}
        </AppText>
      </View>
      <CallButton name={name} phone={phone} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  texts: { flex: 1, minWidth: 0 },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.free,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
});
