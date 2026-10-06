import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { AppText } from "@/components/text";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export function LoadingView({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={styles.box} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.olive} />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <AppText variant="bodyStrong" style={styles.center}>
        {toUserMessage(error)}
      </AppText>
      {onRetry ? <Button label="Réessayer" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.box}>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: space.xxl, gap: space.md, alignItems: "center" },
  center: { textAlign: "center" },
});
