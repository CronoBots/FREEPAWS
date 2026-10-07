import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";

type Props = { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number };

/** Compteur − valeur + pour un petit nombre (personnes, chiens). */
export function Stepper({ label, value, onChange, min = 0, max = 20 }: Props) {
  return (
    <View
      style={styles.row}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
    >
      <AppText variant="bodyStrong" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.controls}>
        <StepButton symbol="−" disabled={value <= min} onPress={() => onChange(value - 1)} label={`${label} −`} />
        <AppText style={styles.value}>{value}</AppText>
        <StepButton symbol="+" disabled={value >= max} onPress={() => onChange(value + 1)} label={`${label} +`} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  disabled,
  onPress,
  label,
}: {
  symbol: string;
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <AppText style={styles.symbol}>{symbol}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 48 },
  label: { flex: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: space.sm },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  symbol: { fontFamily: fonts.sansSemiBold, fontSize: 20, lineHeight: 24, color: colors.ink },
  value: { minWidth: 28, textAlign: "center", fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.ink },
});
