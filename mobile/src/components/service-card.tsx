import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { Service } from "@/api/services";
import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";
import { formatDuration } from "@/utils/dates";
import { formatPrice } from "@/utils/format";

export function ServiceCard({ service }: { service: Service }) {
  const meta = [
    formatDuration(service.duration_minutes),
    service.mode === "event" ? `jusqu'à ${service.default_capacity} familles` : null,
    service.location,
  ].filter(Boolean);

  return (
    <Link href={{ pathname: "/service/[slug]", params: { slug: service.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${service.name}. ${service.summary}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <AppText variant="heading">{service.name}</AppText>
        <AppText variant="body">{service.summary}</AppText>
        <View style={styles.footer}>
          <AppText variant="caption" style={styles.meta}>
            {meta.join(" · ")}
          </AppText>
          <AppText variant="bodyStrong">{formatPrice(service.price_cents)}</AppText>
        </View>
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
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  meta: { flex: 1 },
});
