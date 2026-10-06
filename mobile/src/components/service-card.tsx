import { Link } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import type { Service } from "@/api/services";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";
import { formatPrice } from "@/utils/format";

export function ServiceCard({ service }: { service: Service }) {
  const price = formatPrice(service.price_cents);
  return (
    <Link href={{ pathname: "/service/[slug]", params: { slug: service.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${service.name}. ${service.summary}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <AppText variant="heading">{service.name}</AppText>
        <AppText variant="body">{service.summary}</AppText>
        {price ? <AppText variant="bodyStrong">{price}</AppText> : null}
        <AppText variant="caption" style={styles.more}>
          En savoir plus →
        </AppText>
      </Pressable>
    </Link>
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
  more: { color: colors.ink },
});
