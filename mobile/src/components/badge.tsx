import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

const TONES = {
  // Textes assombris : contraste AA (≥ 4,5:1) sur leur fond pâle.
  success: { bg: colors.freeSoft, fg: "#3a6136" },
  warning: { bg: colors.reservedSoft, fg: colors.brassText },
  neutral: { bg: colors.closedSoft, fg: colors.inkSoft },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
} as const;

export function Badge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof TONES }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="caption" style={[styles.label, { color: fg }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  label: { fontWeight: "600" },
});
