import type { PropsWithChildren, ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/text";
import { colors, space } from "@/theme";

type Props = PropsWithChildren<{
  /** Grand titre en haut d'un onglet (les écrans empilés utilisent l'en-tête natif). */
  title?: string;
  eyebrow?: string;
  /** true si l'écran est affiché sous un en-tête natif (pas de marge de sécurité en haut). */
  underHeader?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}>;

export function Screen({ title, eyebrow, underHeader, refreshing, onRefresh, footer, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: underHeader ? space.lg : insets.top + space.xl, paddingBottom: insets.bottom + space.xxl * 2 },
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.olive} />
          ) : undefined
        }
      >
        <View style={styles.inner}>
          {eyebrow ? <AppText variant="eyebrow">{eyebrow}</AppText> : null}
          {title ? (
            <AppText variant="display" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {children}
        </View>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: space.lg },
  inner: { width: "100%", maxWidth: 640, alignSelf: "center", gap: space.lg },
  title: { marginBottom: space.xs },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
