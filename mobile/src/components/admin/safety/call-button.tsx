import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";

/** Ligne « nom + numéro » avec un bouton d’appel (tel:). Sans numéro, le signale simplement. */
export function CallRow({ name, phone, caption }: { name: string; phone: string | null; caption?: string }) {
  const { t } = useLanguage();
  const number = phone?.replace(/[^\d+]/g, "") ?? "";
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        {caption ? <AppText variant="caption">{caption}</AppText> : null}
        <AppText variant="bodyStrong">{name}</AppText>
        <AppText variant="caption" selectable>
          {phone || t("adminSafety.noPhone")}
        </AppText>
      </View>
      {number ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("adminSafety.callPerson", { name })}
          onPress={() => void Linking.openURL(`tel:${number}`).catch(() => undefined)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Ionicons name="call" size={22} color={colors.white} />
        </Pressable>
      ) : null}
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
