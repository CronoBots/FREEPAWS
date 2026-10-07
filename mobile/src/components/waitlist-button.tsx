import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { useJoinWaitlist, useLeaveWaitlist, useMyWaitlist } from "@/api/park-profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme";
import { dayParts, formatDayLong } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const dayLabel = (day: string) => formatDayLong(`${day}T12:00:00Z`);

/** Inscription (ou désinscription) à la liste d’attente d’un jour sans créneau libre. */
export function WaitlistButton({ serviceId, day }: { serviceId: string; day: string }) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const waitlist = useMyWaitlist();
  const join = useJoinWaitlist();
  const leave = useLeaveWaitlist();
  const [error, setError] = useState<string | null>(null);

  if (!userId || waitlist.isLoading) return null;
  const entry = waitlist.data?.find((row) => row.service_id === serviceId && row.day === day);

  return (
    <View style={styles.block}>
      {entry ? (
        <>
          <AppText variant="bodyStrong" style={styles.ok} accessibilityLiveRegion="polite">
            {t("parkBooking.waitlistJoined", { day: dayLabel(day) })}
          </AppText>
          <Button
            label={t("parkBooking.waitlistLeave")}
            variant="ghost"
            loading={leave.isPending}
            onPress={() => {
              setError(null);
              leave.mutate(entry.id, { onError: (err) => setError(toUserMessage(err)) });
            }}
          />
        </>
      ) : (
        <Button
          label={t("parkBooking.waitlistJoin")}
          variant="secondary"
          loading={join.isPending}
          onPress={() => {
            setError(null);
            join.mutate({ serviceId, day }, { onError: (err) => setError(toUserMessage(err)) });
          }}
        />
      )}
      {error ? (
        <AppText variant="caption" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Liste d’attente d’une prestation : les jours sans créneau libre sont désactivés dans le
 * sélecteur, on les propose donc ici. Rappelle aussi les inscriptions en cours.
 */
export function WaitlistSection({ serviceId, fullDays }: { serviceId: string; fullDays: string[] }) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const waitlist = useMyWaitlist();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  if (!userId) return null;
  const entries = (waitlist.data ?? []).filter((row) => row.service_id === serviceId);
  if (fullDays.length === 0 && entries.length === 0) return null;
  const joinedDays = new Set(entries.map((row) => row.day));

  return (
    <Card>
      <AppText variant="heading">{t("parkBooking.waitlistTitle")}</AppText>
      {entries.map((row) => (
        <WaitlistButton key={row.id} serviceId={serviceId} day={row.day} />
      ))}

      {fullDays.length > 0 ? (
        open ? (
          <>
            <AppText variant="caption">{t("parkBooking.waitlistIntro")}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
              {fullDays.map((item) => {
                const parts = dayParts(item);
                return (
                  <Chip
                    key={item}
                    label={`${parts.weekday} ${parts.day} ${parts.month}`}
                    accessibilityLabel={t("parkBooking.waitlistDayA11y", { day: dayLabel(item) })}
                    selected={day === item}
                    onPress={() => setDay(day === item ? null : item)}
                  />
                );
              })}
            </ScrollView>
            {day && !joinedDays.has(day) ? <WaitlistButton serviceId={serviceId} day={day} /> : null}
            <Button label={t("parkBooking.waitlistHideDays")} variant="ghost" onPress={() => setOpen(false)} />
          </>
        ) : (
          <Button label={t("parkBooking.waitlistShowDays")} variant="secondary" onPress={() => setOpen(true)} />
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  days: { gap: space.sm, paddingVertical: space.xs },
  ok: { color: colors.free },
  error: { color: colors.danger },
});
