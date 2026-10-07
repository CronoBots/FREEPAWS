import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useJoinWaitlist, useLeaveWaitlist, useMyWaitlist } from "@/api/park-profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/theme";
import { formatDayLong } from "@/utils/dates";
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
 * Inscriptions en cours à la liste d’attente d’une prestation (hors jour affiché, déjà traité
 * par le calendrier). L’inscription se fait en choisissant un jour « Complet » dans le sélecteur.
 */
export function WaitlistEntries({ serviceId, exceptDay }: { serviceId: string; exceptDay?: string | null }) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const waitlist = useMyWaitlist();

  if (!userId) return null;
  const entries = (waitlist.data ?? []).filter((row) => row.service_id === serviceId && row.day !== exceptDay);
  if (entries.length === 0) return null;

  return (
    <Card>
      <AppText variant="heading">{t("parkBooking.waitlistTitle")}</AppText>
      {entries.map((row) => (
        <WaitlistButton key={row.id} serviceId={serviceId} day={row.day} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  ok: { color: colors.free },
  error: { color: colors.danger },
});
