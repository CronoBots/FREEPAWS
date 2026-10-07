import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type PricingRule, useSavePricingRule } from "@/api/pricing";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Chip } from "@/components/chip";
import { centsToInput, parseEuros, shortTime, TIME } from "@/components/admin/pricing/format";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useCompact } from "@/hooks/use-compact";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { weekdayName } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

type Kind = PricingRule["kind"];
type Adjustment = "percent" | "amount" | "fixed";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type Props = {
  serviceId: string;
  kind: Kind;
  rule?: PricingRule;
  sortOrder: number;
  onDone: () => void;
};

/** Ajout ou modification d’une règle de prix. Aucune valeur pré-remplie : l’administratrice saisit ses tarifs. */
export function RuleForm({ serviceId, kind, rule, sortOrder, onDone }: Props) {
  const { t } = useLanguage();
  const compact = useCompact();
  const save = useSavePricingRule();

  const initialAdjustment = (rule?.adjustment ?? "percent") as Adjustment;
  const [label, setLabel] = useState(rule?.label ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? []);
  const [start, setStart] = useState(shortTime(rule?.start_time));
  const [end, setEnd] = useState(shortTime(rule?.end_time));
  const [publicHolidays, setPublicHolidays] = useState(rule?.on_public_holidays ?? false);
  const [schoolHolidays, setSchoolHolidays] = useState(rule?.on_school_holidays ?? false);
  const [adjustment, setAdjustment] = useState<Adjustment>(initialAdjustment);
  const [value, setValue] = useState(
    rule == null
      ? ""
      : kind === "off_peak" && initialAdjustment === "percent"
        ? String(rule.value)
        : centsToInput(rule.value),
  );
  const [threshold, setThreshold] = useState(rule == null ? "" : String(rule.threshold));
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));

  const pickAdjustment = (next: Adjustment) => {
    setAdjustment(next);
    setValue("");
  };

  const submit = () => {
    setError(null);
    const base = { service_id: serviceId, kind, label: label.trim(), sort_order: rule?.sort_order ?? sortOrder };

    if (kind === "off_peak") {
      if (weekdays.length === 0 && !publicHolidays && !schoolHolidays) return setError(t("pricing.errorDays"));
      if ((start && !TIME.test(start)) || (end && !TIME.test(end)) || (start && end && end <= start)) {
        return setError(t("pricing.errorTime"));
      }
      let amount: number | null;
      if (adjustment === "percent") {
        const text = value.trim().replace("−", "-").replace("+", "");
        amount = /^-?\d+$/.test(text) ? Number(text) : null;
        if (amount == null || amount < -100 || amount > 500) return setError(t("pricing.errorPercent"));
      } else {
        amount = parseEuros(value, { allowNegative: adjustment === "amount" });
        if (amount == null) return setError(t("pricing.errorAmount"));
      }
      return persist({
        ...base,
        weekdays: [...weekdays].sort((a, b) => a - b),
        start_time: start || null,
        end_time: end || null,
        on_public_holidays: publicHolidays,
        on_school_holidays: schoolHolidays,
        adjustment,
        value: amount,
        threshold: 0,
      });
    }

    const count = /^\d+$/.test(threshold.trim()) ? Number(threshold) : NaN;
    if (kind === "group" ? !(count >= 1 && count <= 50) : !(count >= 0 && count <= 50)) {
      return setError(t(kind === "group" ? "pricing.errorGuests" : "pricing.errorThreshold"));
    }
    const amount = parseEuros(value);
    if (amount == null) return setError(t("pricing.errorAmount"));
    return persist({
      ...base,
      weekdays: [],
      start_time: null,
      end_time: null,
      on_public_holidays: false,
      on_school_holidays: false,
      adjustment: kind === "group" ? "fixed" : "amount",
      value: amount,
      threshold: count,
    });
  };

  const persist = (input: Parameters<typeof save.mutate>[0]) =>
    save.mutate(rule ? { ...input, id: rule.id } : input, {
      onSuccess: onDone,
      onError: (err) => setError(toUserMessage(err)),
    });

  return (
    <Card>
      <AppText variant="heading">{rule ? t("pricing.editRule") : t("pricing.addRule")}</AppText>
      {kind === "off_peak" ? (
        <>
          <TextField
            label={t("pricing.fieldLabel")}
            hint={t("pricing.fieldLabelHint")}
            value={label}
            onChangeText={setLabel}
            maxLength={120}
          />
          <AppText variant="bodyStrong">{t("pricing.fieldWeekdays")}</AppText>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={weekdayName(day, "short")}
                selected={weekdays.includes(day)}
                onPress={() => toggleDay(day)}
              />
            ))}
          </View>
          <Checkbox label={t("pricing.fieldPublicHolidays")} checked={publicHolidays} onChange={setPublicHolidays} />
          <Checkbox label={t("pricing.fieldSchoolHolidays")} checked={schoolHolidays} onChange={setSchoolHolidays} />
          <View style={compact ? styles.stack : styles.pair}>
            <View style={compact ? undefined : styles.flex}>
              <TextField
                label={t("pricing.fieldStart")}
                placeholder="HH:MM"
                value={start}
                onChangeText={setStart}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={compact ? undefined : styles.flex}>
              <TextField
                label={t("pricing.fieldEnd")}
                placeholder="HH:MM"
                value={end}
                onChangeText={setEnd}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          <AppText variant="caption" style={styles.help}>
            {t("pricing.fieldTimesHint")}
          </AppText>
          <AppText variant="bodyStrong">{t("pricing.fieldAdjustment")}</AppText>
          <View style={styles.chips}>
            <Chip
              label={t("pricing.adjustPercent")}
              selected={adjustment === "percent"}
              onPress={() => pickAdjustment("percent")}
            />
            <Chip
              label={t("pricing.adjustAmount")}
              selected={adjustment === "amount"}
              onPress={() => pickAdjustment("amount")}
            />
            <Chip
              label={t("pricing.adjustFixed")}
              selected={adjustment === "fixed"}
              onPress={() => pickAdjustment("fixed")}
            />
          </View>
          <TextField
            label={t(
              adjustment === "percent"
                ? "pricing.fieldPercent"
                : adjustment === "amount"
                  ? "pricing.fieldAmount"
                  : "pricing.fieldFixed",
            )}
            value={value}
            onChangeText={setValue}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </>
      ) : (
        <>
          <TextField label={t("pricing.fieldLabel")} value={label} onChangeText={setLabel} maxLength={120} />
          <TextField
            label={t(kind === "group" ? "pricing.fieldMinGuests" : "pricing.fieldIncludedDogs")}
            value={threshold}
            onChangeText={(text) => setThreshold(text.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={2}
          />
          <TextField
            label={t(kind === "group" ? "pricing.fieldGroupPrice" : "pricing.fieldPerDog")}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            maxLength={10}
          />
        </>
      )}
      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={compact ? styles.stack : styles.pair}>
        <Button
          label={t("pricing.cancel")}
          variant="ghost"
          onPress={onDone}
          style={compact ? undefined : styles.flex}
        />
        <Button
          label={t("pricing.save")}
          loading={save.isPending}
          onPress={submit}
          style={compact ? undefined : styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pair: { flexDirection: "row", gap: space.md },
  stack: { gap: space.md },
  flex: { flex: 1 },
  help: { fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger },
});
