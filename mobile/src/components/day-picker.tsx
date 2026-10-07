import { Pressable, ScrollView, StyleSheet } from "react-native";

import { AppText } from "@/components/text";
import { colors, fonts, radius, space } from "@/theme";
import { useLanguage } from "@/i18n";
import { dayParts } from "@/utils/dates";

type Props = {
  days: string[];
  selected: string | null;
  onSelect: (day: string) => void;
  /** Nombre de créneaux libres par jour ; 0 = jour grisé. */
  counts: Record<string, number>;
};

export function DayPicker({ days, selected, onSelect, counts }: Props) {
  const { t, tp } = useLanguage();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((day) => {
        const parts = dayParts(day);
        const count = counts[day] ?? 0;
        const isSelected = day === selected;
        const disabled = count === 0;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={
              disabled
                ? t("booking.dayFull", { day: `${parts.weekday} ${parts.day} ${parts.month}` })
                : tp("booking.dayAvailable", count, { day: `${parts.weekday} ${parts.day} ${parts.month}` })
            }
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(day)}
            style={[styles.day, isSelected && styles.selected, disabled && styles.disabled]}
          >
            <AppText style={[styles.weekday, isSelected && styles.inverse]}>{parts.weekday}</AppText>
            <AppText style={[styles.number, isSelected && styles.inverse]}>{parts.day}</AppText>
            <AppText style={[styles.month, isSelected && styles.inverse]}>{parts.month}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs },
  day: {
    width: 64,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    gap: 2,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { opacity: 0.35 },
  weekday: { fontFamily: fonts.sansMedium, fontSize: 12, textTransform: "uppercase", color: colors.inkSoft },
  number: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink },
  month: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft },
  inverse: { color: colors.cream },
});
