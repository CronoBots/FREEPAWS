import { StyleSheet, Text, type TextProps } from "react-native";

import { colors, fonts } from "@/theme";

type Variant = "display" | "title" | "heading" | "body" | "bodyStrong" | "caption" | "eyebrow";

export function AppText({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[styles.base, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  base: { color: colors.ink },
  display: { fontFamily: fonts.serifRegular, fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25 },
  // Interlignage du site (line-height 1.7).
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 27, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    // .eyebrow du site : 0.78rem, capitales, interlettrage 0.16em, laiton.
    fontSize: 12.5,
    lineHeight: 18,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.brass,
  },
});
