import { useEffect, useRef } from "react";
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
  /** Jours complets (AAAA-MM-JJ) : sélectionnables pour s’inscrire en liste d’attente. */
  fullDays?: string[];
};

export function DayPicker({ days, selected, onSelect, counts, fullDays }: Props) {
  const { t, tp } = useLanguage();
  const full = new Set(fullDays ?? []);
  const scroller = useRef<ScrollView>(null);
  const selectedIndex = selected ? days.indexOf(selected) : -1;
  // Le jour choisi (souvent le premier jour libre) peut être loin à droite : on l’amène à l’écran.
  useEffect(() => {
    if (selectedIndex < 0) return;
    const timer = setTimeout(
      () =>
        scroller.current?.scrollTo({
          x: Math.max(0, selectedIndex * (DAY_WIDTH + space.sm) - DAY_WIDTH * 1.5),
          animated: true,
        }),
      50,
    );
    return () => clearTimeout(timer);
  }, [selectedIndex]);
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.row}>
      {days.map((day) => {
        const parts = dayParts(day);
        const count = counts[day] ?? 0;
        const isSelected = day === selected;
        const isFull = count === 0 && full.has(day);
        const disabled = count === 0 && !isFull;
        const label = `${parts.weekday} ${parts.day} ${parts.month}`;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={
              isFull
                ? t("parkBooking.dayFullWaitlistA11y", { day: label })
                : disabled
                  ? t("booking.dayFull", { day: label })
                  : tp("booking.dayAvailable", count, { day: label })
            }
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(day)}
            style={[styles.day, isFull && styles.full, isSelected && styles.selected, disabled && styles.disabled]}
          >
            <AppText style={[styles.weekday, isSelected && styles.inverse]}>{parts.weekday}</AppText>
            <AppText style={[styles.number, isSelected && styles.inverse]}>{parts.day}</AppText>
            <AppText style={[styles.month, isSelected && styles.inverse]}>{parts.month}</AppText>
            {isFull ? (
              <AppText
                style={[styles.fullTag, isSelected && styles.inverse]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t("parkBooking.dayFullShort")}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const DAY_WIDTH = 64;

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingTop: space.xs, paddingBottom: space.sm },
  day: {
    width: DAY_WIDTH,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    gap: 2,
  },
  full: { backgroundColor: colors.reservedSoft, borderColor: colors.reserved, borderStyle: "dashed" },
  fullTag: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.danger },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { opacity: 0.5, backgroundColor: "transparent" },
  weekday: { fontFamily: fonts.sansMedium, fontSize: 12, textTransform: "uppercase", color: colors.inkSoft },
  number: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink },
  month: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft },
  inverse: { color: colors.cream },
});
