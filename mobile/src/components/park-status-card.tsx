import { StyleSheet, View } from "react-native";

import type { ParkStatus } from "@/api/park";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { colors, space } from "@/theme";
import { useLanguage } from "@/i18n";
import { formatTime } from "@/utils/dates";

const COLORS = {
  free: colors.free,
  reserved: colors.reserved,
  closed: colors.closed,
  not_open: colors.reserved,
} as const;

export function ParkStatusCard({ status }: { status: ParkStatus | undefined }) {
  const { t } = useLanguage();
  const labels = {
    free: t("status.free"),
    reserved: t("status.reserved"),
    closed: t("status.closed"),
    not_open: t("status.notOpen"),
  };
  const label = status ? labels[status.status] : null;
  const until = status?.until ? formatTime(status.until) : null;
  const detail = !status
    ? t("status.loading")
    : status.status === "not_open"
      ? t("status.notOpenDetail")
      : status.status === "free"
        ? until
          ? t("status.freeUntil", { time: until })
          : t("status.freeNow")
        : status.status === "reserved"
          ? until
            ? t("status.reservedUntil", { time: until })
            : t("status.reservedNow")
          : until
            ? t("status.closedUntil", { time: until })
            : t("status.closedNow");

  return (
    <Card accessibilityRole="summary" accessibilityLabel={t("status.a11y", { label: label ?? "", detail })}>
      <AppText variant="eyebrow">{status?.status === "not_open" ? "FreePaws Park" : t("status.now")}</AppText>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: status ? COLORS[status.status] : colors.line }]} />
        <AppText variant="title">{label ?? "…"}</AppText>
      </View>
      <AppText variant="body">{detail}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
