import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Props = TextInputProps & { label: string; hint?: string; error?: string };

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, style, multiline, ...props },
  ref,
) {
  // Champ multiligne : grandit avec le texte (aucune ligne coupée à mi-hauteur), dans une limite raisonnable.
  const [contentHeight, setContentHeight] = useState(0);
  const autoHeight = multiline ? { height: Math.min(MAX_MULTILINE, Math.max(MIN_MULTILINE, contentHeight)) } : null;
  return (
    <View style={styles.field}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="rgba(74, 92, 76, 0.55)"
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, autoHeight, error ? styles.inputError : null, style]}
        {...props}
        onContentSizeChange={(event) => {
          if (multiline) setContentHeight(event.nativeEvent.contentSize.height);
          props.onContentSizeChange?.(event);
        }}
      />
      {error ? (
        <AppText variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});

const MIN_MULTILINE = 100;
const MAX_MULTILINE = 320;

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },
  multiline: { minHeight: MIN_MULTILINE, paddingTop: space.md, paddingBottom: space.md, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger },
});
