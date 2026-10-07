import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Props = TextInputProps & { label: string; hint?: string; error?: string };

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, style, multiline, ...props },
  ref,
) {
  // Champ multiligne : grandit avec le texte (aucune ligne coupée à mi-hauteur), dans une limite raisonnable.
  const [contentHeight, setContentHeight] = useState(0);
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => input.current as TextInput);

  // Web : onContentSizeChange n’est pas fiable (mesure faite avant la largeur ou la police finale).
  // On mesure le textarea lui-même : hauteur remise à « auto », puis scrollHeight.
  const measureWeb = useCallback(() => {
    if (Platform.OS !== "web" || !multiline) return;
    const node = input.current as unknown as HTMLTextAreaElement | null;
    if (!node || typeof node.scrollHeight !== "number") return;
    const previous = node.style.height;
    node.style.height = "auto";
    const height = node.scrollHeight + 2; // bordures
    node.style.height = previous;
    setContentHeight(height);
  }, [multiline]);

  useEffect(() => {
    if (Platform.OS !== "web" || !multiline) return;
    const frame = requestAnimationFrame(measureWeb);
    return () => cancelAnimationFrame(frame);
  }, [measureWeb, multiline, props.value]);
  const autoHeight = multiline ? { height: Math.min(MAX_MULTILINE, Math.max(MIN_MULTILINE, contentHeight)) } : null;
  return (
    <View style={styles.field}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor="rgba(74, 92, 76, 0.55)"
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, autoHeight, error ? styles.inputError : null, style]}
        {...props}
        onContentSizeChange={(event) => {
          if (multiline && Platform.OS !== "web") setContentHeight(event.nativeEvent.contentSize.height);
          props.onContentSizeChange?.(event);
        }}
        onLayout={(event) => {
          measureWeb();
          props.onLayout?.(event);
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
