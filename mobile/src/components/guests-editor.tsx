import { StyleSheet, View } from "react-native";

import type { GuestInput } from "@/api/park-profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";

/** Plafond aligné sur set_booking_guests (20 invités). */
export const MAX_GUESTS = 20;

export type GuestDraft = { key: string; full_name: string; email: string; phone: string };

let counter = 0;
const newKey = () => `guest-${Date.now()}-${counter++}`;

export function toGuestDrafts(rows: { full_name: string; email?: string | null; phone?: string | null }[]) {
  return rows.map((row) => ({
    key: newKey(),
    full_name: row.full_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
  }));
}

/** Chaque ligne commencée doit porter un nom. */
export function guestsValid(drafts: GuestDraft[]) {
  return drafts.every((guest) => guest.full_name.trim().length > 0);
}

export function toGuestInputs(drafts: GuestDraft[]): GuestInput[] {
  return drafts
    .filter((guest) => guest.full_name.trim())
    .map((guest) => ({
      full_name: guest.full_name.trim(),
      email: guest.email.trim() || null,
      phone: guest.phone.trim() || null,
    }));
}

type Props = {
  value: GuestDraft[];
  onChange: (value: GuestDraft[]) => void;
  /** Affiche « Nom obligatoire » sur les lignes sans nom (après une tentative d’envoi). */
  showErrors?: boolean;
};

export function GuestsEditor({ value, onChange, showErrors = false }: Props) {
  const { t } = useLanguage();

  const update = (key: string, patch: Partial<GuestDraft>) =>
    onChange(value.map((guest) => (guest.key === key ? { ...guest, ...patch } : guest)));

  return (
    <Card>
      <AppText variant="heading">{t("parkBooking.guestsTitle")}</AppText>
      <AppText variant="caption">{t("parkBooking.guestsResponsibility")}</AppText>

      {value.length === 0 ? <AppText variant="caption">{t("parkBooking.guestsEmpty")}</AppText> : null}

      {value.map((guest, index) => (
        <View key={guest.key} style={styles.guest}>
          <View style={styles.guestHeader}>
            <AppText variant="bodyStrong" style={styles.guestTitle}>
              {t("parkBooking.guestLabel", { n: index + 1 })}
            </AppText>
            <Button
              label={t("parkBooking.guestRemove")}
              variant="dangerText"
              onPress={() => onChange(value.filter((item) => item.key !== guest.key))}
              style={styles.remove}
            />
          </View>
          <TextField
            label={t("parkBooking.guestName")}
            value={guest.full_name}
            onChangeText={(full_name) => update(guest.key, { full_name })}
            autoComplete="off"
            maxLength={120}
            error={showErrors && !guest.full_name.trim() ? t("parkBooking.guestNameError") : undefined}
          />
          <TextField
            label={t("parkBooking.guestEmail")}
            value={guest.email}
            onChangeText={(email) => update(guest.key, { email })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={200}
          />
          <TextField
            label={t("parkBooking.guestPhone")}
            value={guest.phone}
            onChangeText={(phone) => update(guest.key, { phone })}
            keyboardType="phone-pad"
            autoComplete="off"
            maxLength={30}
          />
        </View>
      ))}

      <Button
        label={t("parkBooking.guestAdd")}
        variant="secondary"
        disabled={value.length >= MAX_GUESTS}
        onPress={() => onChange([...value, { key: newKey(), full_name: "", email: "", phone: "" }])}
      />
      <AppText variant="caption">{t("parkBooking.guestsMax", { count: MAX_GUESTS })}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  guest: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  guestHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  guestTitle: { flex: 1, minWidth: 100 },
  remove: { minHeight: 40, paddingHorizontal: space.sm },
});
