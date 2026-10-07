import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

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
  /** Agenda : nombre d’éléments par jour, signalé par une pastille quand il est supérieur à 0. */
  marks?: Record<string, number>;
  /** Libellé lu par le lecteur d’écran quand `marks` est fourni (à la place de « n créneaux libres »). */
  markLabel?: (day: string, count: number) => string;
};

export function DayPicker({ days, selected, onSelect, counts, fullDays, marks, markLabel }: Props) {
  const { t, tp } = useLanguage();
  const full = new Set(fullDays ?? []);
  const scroller = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  // Sur ordinateur, la molette ne fait pas défiler horizontalement : flèches précédent / suivant.
  const arrows = Platform.OS === "web" && windowWidth >= 768;
  const [scroll, setScroll] = useState({ x: 0, view: 0, content: 0 });
  const selectedIndex = selected ? days.indexOf(selected) : -1;
  // Le jour choisi (souvent le premier jour libre) peut être loin à droite : on l’amène à l’écran,
  // calé sur le bord d’une carte (la carte précédente reste visible en entier).
  useEffect(() => {
    if (selectedIndex < 0) return;
    const timer = setTimeout(
      () => scroller.current?.scrollTo({ x: Math.max(0, (selectedIndex - 1) * STEP), animated: true }),
      50,
    );
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const page = Math.max(STEP, Math.floor(scroll.view / STEP - 1) * STEP);
  const maxX = Math.max(0, scroll.content - scroll.view);
  const scrollBy = (delta: number) =>
    scroller.current?.scrollTo({ x: Math.min(maxX, Math.max(0, scroll.x + delta)), animated: true });

  const list = (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={styles.row}
      style={arrows ? styles.scroller : undefined}
      scrollEventThrottle={64}
      onScroll={(event) => {
        const x = event.nativeEvent.contentOffset.x;
        setScroll((prev) => (prev.x === x ? prev : { ...prev, x }));
      }}
      onLayout={(event) => {
        const view = event.nativeEvent.layout.width;
        setScroll((prev) => (prev.view === view ? prev : { ...prev, view }));
      }}
      onContentSizeChange={(content) => setScroll((prev) => (prev.content === content ? prev : { ...prev, content }))}
    >
      {days.map((day) => {
        const parts = dayParts(day);
        const count = counts[day] ?? 0;
        const isSelected = day === selected;
        const isFull = count === 0 && full.has(day);
        const disabled = count === 0 && !isFull;
        const label = `${parts.weekday} ${parts.day} ${parts.month}`;
        const mark = marks?.[day] ?? 0;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={
              marks && markLabel && !disabled
                ? markLabel(label, mark)
                : isFull
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
            <AppText style={[styles.weekday, isSelected && styles.inverse, disabled && styles.disabledText]}>
              {parts.weekday}
            </AppText>
            <AppText style={[styles.number, isSelected && styles.inverse, disabled && styles.disabledText]}>
              {parts.day}
            </AppText>
            <AppText style={[styles.month, isSelected && styles.inverse, disabled && styles.disabledText]}>
              {parts.month}
            </AppText>
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
            {marks ? (
              <View style={[styles.mark, mark > 0 && styles.markOn, mark > 0 && isSelected && styles.markInverse]} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (!arrows) return list;
  return (
    <View style={styles.withArrows}>
      <Arrow symbol="‹" label={t("booking.daysPrevious")} disabled={scroll.x <= 1} onPress={() => scrollBy(-page)} />
      {list}
      <Arrow symbol="›" label={t("booking.daysNext")} disabled={scroll.x >= maxX - 1} onPress={() => scrollBy(page)} />
    </View>
  );
}

function Arrow({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, disabled && styles.arrowDisabled, pressed && styles.arrowPressed]}
    >
      <AppText style={styles.arrowSymbol}>{symbol}</AppText>
    </Pressable>
  );
}

const DAY_WIDTH = 64;
const STEP = DAY_WIDTH + space.sm;

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
  // Jour sans créneau : sans fond, texte gris lisible (pas d’opacité qui le rendrait illisible).
  disabled: { backgroundColor: "transparent" },
  disabledText: { color: colors.closed },
  withArrows: { flexDirection: "row", alignItems: "center", gap: space.xs },
  scroller: { flex: 1 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowDisabled: { opacity: 0.35 },
  arrowPressed: { opacity: 0.7 },
  arrowSymbol: { fontFamily: fonts.sansSemiBold, fontSize: 22, lineHeight: 24, color: colors.ink },
  weekday: { fontFamily: fonts.sansMedium, fontSize: 12, textTransform: "uppercase", color: colors.inkSoft },
  number: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.ink },
  month: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft },
  inverse: { color: colors.cream },
  // Pastille « a des rendez-vous » (agenda) ; emplacement réservé même vide pour garder la même hauteur.
  mark: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  markOn: { backgroundColor: colors.olive },
  markInverse: { backgroundColor: colors.cream },
});
