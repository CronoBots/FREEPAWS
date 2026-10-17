import type { PropsWithChildren, ReactNode, RefObject } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spine, Tick, useSpineGeometry } from "@/components/spine";
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
  /** Repère du titre sur la colonne vertébrale, comme les pages du site (« FR—03 » pour le parc…). */
  tickLabel?: string;
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
  tickLabel,
  underHeader,
  refreshing,
  onRefresh,
  footer,
  scrollRef,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const compact = useCompact();
  const geometry = useSpineGeometry();
  // La colonne garde 640 px de contenu, à droite du filet vertical.
  const columnWidth = CONTENT_MAX_WIDTH + geometry.x + geometry.gap;
  const sidePadding = geometry.wide ? space.lg : 0;
  const hasHeader = Boolean(eyebrow || title || heading);
  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: sidePadding,
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
        <Spine style={[styles.inner, { maxWidth: columnWidth }]}>
          {hasHeader ? (
            <Tick label={tickLabel} offset={eyebrow ? 9 : title ? 21 : 16}>
              <View style={styles.header}>
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
              </View>
            </Tick>
          ) : null}
          {children}
        </Spine>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingLeft: sidePadding, paddingBottom: insets.bottom + space.md }]}>
          {/* Aligné sur la colonne de contenu, à droite du filet. */}
          <View style={[styles.footerInner, { maxWidth: columnWidth, paddingLeft: geometry.x + geometry.gap }]}>
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: space.lg },
  inner: { width: "100%", alignSelf: "center", gap: space.lg },
  header: { gap: space.xs },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  headingCompact: { fontSize: 22, lineHeight: 28 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerInner: { width: "100%", alignSelf: "center" },
});
