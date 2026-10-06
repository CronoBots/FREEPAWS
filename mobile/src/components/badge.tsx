import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, radius, space } from "@/theme";

const TONES = {
  success: { bg: colors.freeSoft, fg: colors.free },
  warning: { bg: colors.reservedSoft, fg: colors.reserved },
  neutral: { bg: colors.closedSoft, fg: colors.closed },
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
