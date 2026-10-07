import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { fetchBookingsForExport, type Stats, useStats } from "@/api/admin-park";
import { BarList, ProgressBar, StatTile } from "@/components/admin/safety/charts";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { getLocale, type TranslationKey, useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { shareTextFile } from "@/lib/share-file";
import { colors, space } from "@/theme";
import { toCsv } from "@/utils/csv";
import { addDays, formatDate, formatTime, toIsoDay, weekdayName } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { formatPrice } from "@/utils/format";
import { parseRange } from "@/utils/range";

type Period = "week" | "days30" | "month" | "year";

const PERIODS: [Period, TranslationKey][] = [
  ["week", "adminSafety.periodWeek"],
  ["days30", "adminSafety.period30"],
  ["month", "adminSafety.periodMonth"],
  ["year", "adminSafety.periodYear"],
];

/** Heures d’ouverture ou réservées, toujours en heures (« 0 h », « 7,5 h ») pour comparer les deux chiffres. */
function formatHours(minutes: number): string {
  const hours = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(minutes / 60);
  return `${hours}\u00a0h`;
}

/** Pourcentage selon la langue : « 42 % » en français, « 42% » en anglais. */
function formatPercent(rate: number): string {
  return new Intl.NumberFormat(getLocale(), { style: "percent", maximumFractionDigits: 0 }).format(rate);
}

/** Bornes AAAA-MM-JJ (incluses) de la période, en jours calendaires de Bruxelles. */
function periodRange(period: Period, today: string): { from: string; to: string } {
  switch (period) {
    case "week":
      return { from: addDays(today, -6), to: today };
    case "days30":
      return { from: addDays(today, -29), to: today };
    case "month": {
      const first = `${today.slice(0, 8)}01`;
      const [y, m] = today.split("-").map(Number) as [number, number];
      const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { from: first, to: addDays(nextFirst, -1) };
    }
    case "year":
      return { from: addDays(today, -364), to: today };
  }
}

export default function AdminDashboardRoute() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}

function Dashboard() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("days30");
  const { from, to } = periodRange(period, toIsoDay(new Date()));
  const stats = useStats(from, to);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchBookingsForExport(from, to);
      if (rows.length === 0) {
        notify(t("adminSafety.exportBookings"), t("adminSafety.exportEmpty"));
        return;
      }
      const euros = (cents: number | null) => (cents == null ? null : (cents / 100).toFixed(2).replace(".", ","));
      const csv = toCsv(
        [
          t("adminSafety.csvDay"),
          t("adminSafety.csvStart"),
          t("adminSafety.csvEnd"),
          t("adminSafety.csvService"),
          t("adminSafety.csvStatus"),
          t("adminSafety.csvClient"),
          t("adminSafety.csvEmail"),
          t("adminSafety.csvPhone"),
          t("adminSafety.csvAdults"),
          t("adminSafety.csvChildren"),
          t("adminSafety.csvDogs"),
          t("adminSafety.csvPrice"),
          t("adminSafety.csvDiscount"),
          t("adminSafety.csvCode"),
          t("adminSafety.csvAddress"),
          t("adminSafety.csvCreated"),
        ],
        rows.map((row) => {
          const range = row.appointment?.period ? parseRange(String(row.appointment.period)) : null;
          return [
            range ? toIsoDay(range.start) : null,
            range ? formatTime(range.start) : null,
            range ? formatTime(range.end) : null,
            row.appointment?.service?.name,
            row.status === "confirmed" ? t("adminSafety.statusConfirmed") : t("adminSafety.statusCancelled"),
            row.client?.full_name,
            row.client?.email,
            row.client?.phone,
            row.adults_count,
            row.children_count,
            row.dogs_count,
            euros(row.price_cents),
            euros(row.discount_cents),
            row.discount?.code,
            row.visit_address,
            toIsoDay(row.created_at),
          ];
        }),
      );
      await shareTextFile(`${t("adminSafety.exportFileName")}-${from}-${to}.csv`, csv, "text/csv");
    } catch (err) {
      notify(t("adminSafety.exportBookings"), toUserMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen underHeader refreshing={stats.isRefetching} onRefresh={() => void stats.refetch()}>
      {/* Une seule ligne qui défile : aucun filtre ne se retrouve seul sur une deuxième ligne. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PERIODS.map(([key, label]) => (
          <Chip key={key} label={t(label)} selected={period === key} onPress={() => setPeriod(key)} />
        ))}
      </ScrollView>
      <AppText variant="caption">
        {t("adminSafety.periodRange", { from: formatDate(`${from}T12:00:00Z`), to: formatDate(`${to}T12:00:00Z`) })}
      </AppText>

      {stats.isLoading ? (
        <LoadingView />
      ) : stats.isError ? (
        <ErrorView error={stats.error} onRetry={() => void stats.refetch()} />
      ) : stats.data ? (
        <StatsContent stats={stats.data} />
      ) : null}

      <Button
        label={t("adminSafety.exportBookings")}
        variant="secondary"
        loading={exporting}
        disabled={stats.data != null && stats.data.bookings === 0 && stats.data.cancellations === 0}
        onPress={() => void exportCsv()}
      />
    </Screen>
  );
}

function StatsContent({ stats }: { stats: Stats }) {
  const { t } = useLanguage();
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    key: String(day),
    label: weekdayName(day, "short"),
    count: stats.by_weekday[String(day)] ?? 0,
  }));
  const hourKeys = Object.keys(stats.by_hour).map(Number);
  const hours =
    hourKeys.length === 0
      ? []
      : Array.from({ length: Math.max(...hourKeys) - Math.min(...hourKeys) + 1 }, (_, index) => {
          const hour = Math.min(...hourKeys) + index;
          return {
            key: String(hour),
            label: t("adminSafety.hourLabel", { hour }),
            count: stats.by_hour[String(hour)] ?? 0,
          };
        });

  return (
    <>
      <View style={styles.tiles}>
        <StatTile
          label={t("adminSafety.statBookings")}
          value={String(stats.bookings)}
          hint={t("adminSafety.statsHint")}
        />
        <StatTile label={t("adminSafety.statCancellations")} value={String(stats.cancellations)} />
        <StatTile label={t("adminSafety.statRevenue")} value={formatPrice(stats.revenue_cents) ?? "—"} />
        <StatTile label={t("adminSafety.statNewClients")} value={String(stats.new_clients)} />
      </View>

      {stats.fill_rate.length > 0 ? (
        <Card>
          <AppText variant="heading">{t("adminSafety.fillRateTitle")}</AppText>
          {stats.fill_rate.map((item) => (
            <View key={item.resource} style={styles.fillRow}>
              <View style={styles.fillHead}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {item.resource}
                </AppText>
                {item.rate != null ? <AppText variant="bodyStrong">{formatPercent(item.rate)}</AppText> : null}
              </View>
              {item.rate != null ? (
                <>
                  <ProgressBar value={item.rate} label={item.resource} />
                  <AppText variant="caption">
                    {t("adminSafety.fillRateDetail", {
                      booked: formatHours(item.booked_minutes),
                      open: formatHours(item.open_minutes),
                    })}
                  </AppText>
                </>
              ) : (
                <AppText variant="caption">{t("adminSafety.fillRateNoHours")}</AppText>
              )}
            </View>
          ))}
        </Card>
      ) : null}

      {stats.bookings === 0 ? (
        <AppText variant="body" style={styles.muted}>
          {t("adminSafety.noBookings")}
        </AppText>
      ) : (
        <>
          <Card>
            <AppText variant="heading">{t("adminSafety.byServiceTitle")}</AppText>
            {stats.by_service.map((item) => (
              <View key={item.name} style={styles.serviceRow}>
                <AppText variant="body" style={styles.flex}>
                  {item.name}
                </AppText>
                <View style={styles.serviceNumbers}>
                  <AppText variant="bodyStrong">{item.count}</AppText>
                  {item.revenue_cents > 0 ? (
                    <AppText variant="caption">{formatPrice(item.revenue_cents)}</AppText>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <AppText variant="heading">{t("adminSafety.byWeekdayTitle")}</AppText>
            <BarList bars={weekdays} />
          </Card>

          <Card>
            <AppText variant="heading">{t("adminSafety.byHourTitle")}</AppText>
            <BarList bars={hours} />
            <AppText variant="caption">{t("adminSafety.histogramHint")}</AppText>
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: space.sm },
  muted: { color: colors.inkSoft },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fillRow: { gap: space.xs, paddingVertical: space.xs },
  fillHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  serviceNumbers: { alignItems: "flex-end" },
});
