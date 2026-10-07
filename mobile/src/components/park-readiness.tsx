import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDogs } from "@/api/dogs";
import { useProfile } from "@/api/profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { formatDate, toIsoDay } from "@/utils/dates";

const filled = (value: string | null | undefined) => Boolean(value?.trim());

/**
 * Ce qui manque pour réserver le parc (mêmes contrôles que le serveur, sauf les vaccins,
 * validés par FreePaws). N’affiche rien quand tout est complet ou pendant le chargement.
 * `day` : jour de la réservation (AAAA-MM-JJ) pour juger la validité de l’assurance.
 */
export function ParkReadiness({ day }: { day?: string | null }) {
  const { t } = useLanguage();
  const profile = useProfile();
  const dogs = useDogs();

  if (!profile.data || !dogs.data) return null;
  const me = profile.data;
  const today = toIsoDay(new Date());
  const refDay = day && day > today ? day : today;
  const [year, month, date] = today.split("-");
  const adultLimit = `${Number(year) - 18}-${month}-${date}`;

  const profileItems: string[] = [];
  if (!me.birth_date) profileItems.push(t("parkBooking.missingBirthDate"));
  else if (me.birth_date > adultLimit) profileItems.push(t("parkBooking.notAdult"));
  if (!filled(me.emergency_contact_name) || !filled(me.emergency_contact_phone)) {
    profileItems.push(t("parkBooking.missingEmergency"));
  }
  if (!filled(me.insurance_company) || !me.insurance_valid_until) {
    profileItems.push(t("parkBooking.missingInsurance"));
  } else if (me.insurance_valid_until < refDay) {
    profileItems.push(t("parkBooking.insuranceExpired", { date: formatDate(`${me.insurance_valid_until}T12:00:00Z`) }));
  }
  const noDogs = dogs.data.length === 0;

  if (profileItems.length === 0 && !noDogs) return null;

  return (
    <Card style={styles.card} accessibilityRole="summary">
      <AppText variant="heading">{t("parkBooking.readinessTitle")}</AppText>
      <AppText variant="caption">{t("parkBooking.readinessText")}</AppText>
      <View style={styles.list}>
        {[...profileItems, ...(noDogs ? [t("parkBooking.missingDogs")] : [])].map((item) => (
          <View key={item} style={styles.item}>
            <View style={styles.dot} />
            <AppText variant="body" style={styles.itemText}>
              {item}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption">{t("parkBooking.vaccinesReminder")}</AppText>
      <View style={styles.actions}>
        {profileItems.length > 0 ? (
          <Button
            label={t("parkBooking.completeProfile")}
            variant="secondary"
            onPress={() => router.push("/profile")}
          />
        ) : null}
        {noDogs ? (
          <Button
            label={t("parkBooking.addDogs")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: "new" } })}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.reservedSoft, borderColor: colors.reserved },
  list: { gap: space.xs },
  item: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.reserved, marginTop: 9 },
  itemText: { flex: 1 },
  actions: { gap: space.sm },
});
