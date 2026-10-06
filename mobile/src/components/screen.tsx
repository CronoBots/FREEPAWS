import type { PropsWithChildren, ReactNode, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/text";
import { useCompact } from "@/hooks/use-compact";
import { colors, space } from "@/theme";

/** Largeur maximale du contenu (tablettes, web) : texte lisible et colonnes alignées. */
export const CONTENT_MAX_WIDTH = 640;

type Props = PropsWithChildren<{
  /** Grand titre d’un onglet. */
  title?: string;
  /** Titre d’un écran empilé, affiché dans le contenu (retour à la ligne, jamais tronqué). */
  heading?: string;
  eyebrow?: string;
  /** true si l’écran est affiché sous un en-tête natif (pas de marge de sécurité en haut). */
  underHeader?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
}>;

export function Screen({
  title,
  heading,
  eyebrow,
  underHeader,
  refreshing,
  onRefresh,
  footer,
  scrollRef,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const compact = useCompact();
  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: underHeader ? space.lg : insets.top + space.xl,
            paddingBottom: footer ? space.xl : insets.bottom + space.xxl * 2,
          },
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
            <AppText variant="display" accessibilityRole="header" style={compact && styles.titleCompact}>
              {title}
            </AppText>
          ) : null}
          {heading ? (
            <AppText variant="title" accessibilityRole="header" style={compact && styles.headingCompact}>
              {heading}
            </AppText>
          ) : null}
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: space.lg },
  inner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", gap: space.lg },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  headingCompact: { fontSize: 22, lineHeight: 28 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerInner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
});
