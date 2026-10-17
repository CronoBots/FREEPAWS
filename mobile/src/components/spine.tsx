import { createContext, type PropsWithChildren, useContext } from "react";
import { StyleSheet, useWindowDimensions, View, type ViewProps } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, spine } from "@/theme";

type Geometry = { x: number; gap: number; tick: number; wide: boolean };

/** Géométrie de la colonne vertébrale selon la largeur (valeurs du CSS de freepaws.be). */
export function useSpineGeometry(): Geometry {
  const { width } = useWindowDimensions();
  const wide = width >= spine.breakpoint;
  return { ...(wide ? spine.wide : spine.narrow), wide };
}

const SpineContext = createContext<Geometry | null>(null);

/**
 * Colonne vertébrale : filet vertical à gauche du contenu (.spine-wrap du site).
 * Le contenu est décalé à droite du filet ; les <Tick> placés dedans s’y raccrochent.
 */
export function Spine({ children, style, ...props }: ViewProps) {
  const geometry = useSpineGeometry();
  return (
    <SpineContext.Provider value={geometry}>
      <View {...props} style={[styles.wrap, { paddingLeft: geometry.x + geometry.gap }, style]}>
        <View pointerEvents="none" style={[styles.line, { left: geometry.x }]} />
        {children}
      </View>
    </SpineContext.Provider>
  );
}

type TickProps = PropsWithChildren<{
  /** Repère affiché à gauche du filet sur grand écran (comme « 01 », « FR—01 » sur le site). */
  label?: string;
  /** Hauteur du trait depuis le haut du bloc (le site le place à 0.6em du texte). */
  offset?: number;
}>;

/**
 * Début de section (.tick du site) : petit trait laiton qui coupe le filet vertical,
 * avec son repère à gauche sur grand écran. Hors d’une <Spine>, il n’affiche que son contenu.
 */
export function Tick({ label, offset = 10, children }: TickProps) {
  const geometry = useContext(SpineContext);
  if (!geometry) return <>{children}</>;
  // Grand écran : le trait part du filet vers le contenu. Téléphone : il arrive sur le filet par la gauche.
  const tickLeft = geometry.wide ? -geometry.gap : -geometry.gap - geometry.tick;
  return (
    <View style={styles.tick}>
      <View pointerEvents="none" style={[styles.tickLine, { left: tickLeft, top: offset, width: geometry.tick }]} />
      {geometry.wide && label ? (
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no"
          numberOfLines={1}
          style={[
            styles.tickLabel,
            { left: -(geometry.gap + 18 + geometry.x - 24), top: offset - 8, width: geometry.x - 24 },
          ]}
        >
          {label}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  line: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: colors.line },
  tick: { position: "relative" },
  tickLine: { position: "absolute", height: 1, backgroundColor: colors.brass },
  tickLabel: {
    position: "absolute",
    textAlign: "right",
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
    color: colors.brass,
  },
});
