import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import type { Service } from "@/api/services";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";
import { formatPrice } from "@/utils/format";
import { useLanguage } from "@/i18n";

export function ServiceCard({ service }: { service: Service }) {
  const { t } = useLanguage();
  const price = formatPrice(service.displayPriceCents);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/service/[slug]", params: { slug: service.slug } })}
      accessibilityRole="link"
      accessibilityLabel={`${service.name}. ${service.summary}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <AppText variant="heading">{service.name}</AppText>
      <AppText variant="body">{service.summary}</AppText>
      {price ? <AppText variant="bodyStrong">{price}</AppText> : null}
      <AppText variant="bodyStrong" style={styles.more}>
        {t("coaching.more")}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamAlt,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
  },
  pressed: { opacity: 0.8 },
  // Seule action de la carte : couleur de marque pour qu’on la repère.
  more: { color: colors.olive },
});
