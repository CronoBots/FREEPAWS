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
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brass,
  },
});
