import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type CalendarDay, useAddCalendarDays, useCalendarDays, useDeleteCalendarDays } from "@/api/pricing";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { DateField } from "@/components/date-field";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors } from "@/theme";
import { addDays, formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

type Kind = CalendarDay["kind"];
type Group = { kind: Kind; label: string; days: string[] };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date AAAA-MM-JJ réelle (refuse le 31 février). */
function isValidDay(text: string) {
  const match = DATE.exec(text);
  if (!match) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/** Jours consécutifs de même type et même libellé regroupés en périodes. */
function groupDays(days: CalendarDay[]): Group[] {
  const groups: Group[] = [];
  for (const item of [...days].sort((a, b) => a.day.localeCompare(b.day))) {
    const last = groups.at(-1);
    const previous = last?.days.at(-1);
    if (last && previous && last.kind === item.kind && last.label === item.label && addDays(previous, 1) === item.day) {
      last.days.push(item.day);
    } else {
      groups.push({ kind: item.kind, label: item.label, days: [item.day] });
    }
  }
  return groups;
}

const noon = (day: string) => `${day}T12:00:00Z`;

export default function AdminCalendarDaysRoute() {
  return (
    <AdminGuard>
      <CalendarDays />
    </AdminGuard>
  );
}

function CalendarDays() {
  const { t, tp } = useLanguage();
  const days = useCalendarDays();
  const add = useAddCalendarDays();
  const remove = useDeleteCalendarDays();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<Kind>("public_holiday");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const end = to.trim() || from.trim();
    if (!isValidDay(from.trim()) || !isValidDay(end) || end < from.trim()) return setError(t("pricing.errorDate"));
    if (new Date(noon(end)).getTime() - new Date(noon(from.trim())).getTime() > 365 * 86_400_000) {
      return setError(t("pricing.errorDate"));
    }
    add.mutate(
      { from: from.trim(), to: end, kind, label: label.trim() },
      {
        onSuccess: () => {
          setFrom("");
          setTo("");
          setLabel("");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  const askDelete = async (group: Group) => {
    const ok = await confirm({
      title: t("pricing.deleteDaysTitle"),
      message: t("pricing.deleteDaysMessage"),
      confirmLabel: t("pricing.deleteRule"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(group.days[0] ?? null);
    remove.mutate(group.days, {
      onError: (err) => notify(t("pricing.deleteDaysTitle"), toUserMessage(err)),
      onSettled: () => setDeleting(null),
    });
  };

  const groups = groupDays(days.data ?? []);

  return (
    <Screen underHeader refreshing={days.isRefetching} onRefresh={() => void days.refetch()}>
      <AppText variant="body">{t("pricing.daysIntro")}</AppText>

      <Card>
        <AppText variant="heading">{t("pricing.addPeriod")}</AppText>
        <DateField label={t("pricing.fieldFrom")} value={from} onChange={setFrom} />
        <DateField label={t("pricing.fieldTo")} hint={t("pricing.fieldToHint")} value={to} onChange={setTo} />
        <AppText variant="bodyStrong">{t("pricing.dayKind")}</AppText>
        {/* Choix entre deux options : deux segments de même largeur, jamais empilés de travers. */}
        <Segmented<Kind>
          accessibilityLabel={t("pricing.dayKind")}
          options={[
            { value: "public_holiday", label: t("pricing.kindPublicHoliday") },
            { value: "school_holiday", label: t("pricing.kindSchoolHoliday") },
          ]}
          value={kind}
          onChange={setKind}
        />
        <TextField label={t("pricing.fieldDayLabel")} value={label} onChangeText={setLabel} maxLength={120} />
        {error ? (
          <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <Button label={t("pricing.add")} loading={add.isPending} onPress={submit} />
      </Card>

      <AppText variant="heading">{t("pricing.daysListTitle")}</AppText>
      {days.isLoading ? (
        <LoadingView />
      ) : days.isError ? (
        <ErrorView error={days.error} onRetry={() => void days.refetch()} />
      ) : groups.length === 0 ? (
        <AppText variant="body">{t("pricing.noDays")}</AppText>
      ) : (
        groups.map((group) => {
          const first = group.days[0]!;
          const last = group.days.at(-1)!;
          return (
            <Card key={first}>
              <Badge
                label={t(group.kind === "public_holiday" ? "pricing.kindPublicHoliday" : "pricing.kindSchoolHoliday")}
                tone={group.kind === "public_holiday" ? "warning" : "neutral"}
              />
              {group.label ? <AppText variant="bodyStrong">{group.label}</AppText> : null}
              <AppText variant="body">
                {first === last
                  ? formatDate(noon(first))
                  : t("pricing.dayRange", { from: formatDate(noon(first)), to: formatDate(noon(last)) })}
              </AppText>
              <AppText variant="caption">{tp("pricing.dayCount", group.days.length)}</AppText>
              <View style={styles.actions}>
                <Button
                  label={t("pricing.deleteRule")}
                  variant="dangerText"
                  loading={remove.isPending && deleting === first}
                  onPress={() => void askDelete(group)}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", justifyContent: "flex-end" },
  error: { color: colors.danger },
});
