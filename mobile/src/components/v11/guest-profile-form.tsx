import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type GuestInvitation, useCompleteGuestProfile } from "@/api/v11-client";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type DogDraft, DogFields, newDogDraft, toGroupDog } from "@/components/v11/dog-fields";
import { useLanguage } from "@/i18n";
import { colors, radius, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

/** Profil allégé d’un participant invité, à compléter avant l’accès au direct (M2-10). */
export function GuestProfileForm({ token, invitation }: { token: string; invitation: GuestInvitation }) {
  const { t } = useLanguage();
  const complete = useCompleteGuestProfile(token);
  const [fullName, setFullName] = useState(invitation.fullName);
  const [email, setEmail] = useState(invitation.email ?? "");
  const [phone, setPhone] = useState(invitation.phone ?? "");
  const [contactName, setContactName] = useState(invitation.emergencyContactName ?? "");
  const [contactPhone, setContactPhone] = useState(invitation.emergencyContactPhone ?? "");
  const [dog, setDog] = useState<DogDraft>(() => newDogDraft(invitation.dog));
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [openDocument, setOpenDocument] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = invitation.documents.filter((document) => !document.accepted);
  const required = (value: string) => (showErrors && !value.trim() ? t("v11Client.guestFieldRequired") : undefined);
  const contactMissing = !email.trim() && !phone.trim();

  const onSubmit = () => {
    setShowErrors(true);
    if (!fullName.trim() || contactMissing || !contactName.trim() || !contactPhone.trim()) {
      return setError(t("v11Client.guestFormMissing"));
    }
    if (!pending.every((document) => accepted[document.id])) return setError(t("v11Client.guestDocumentsMissing"));
    setError(null);
    complete.mutate(
      {
        profile: {
          full_name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          emergency_contact_name: contactName.trim(),
          emergency_contact_phone: contactPhone.trim(),
          dog: dog.name.trim() ? toGroupDog(dog) : null,
        },
        documentIds: pending.map((document) => document.id),
      },
      { onError: (err) => setError(toUserMessage(err)) },
    );
  };

  return (
    <View style={styles.form}>
      <Card>
        <AppText variant="heading">{t("v11Client.guestFormTitle")}</AppText>
        <AppText variant="body">{t("v11Client.guestFormIntro")}</AppText>
        <TextField
          label={t("v11Client.guestFullName")}
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
          maxLength={120}
          error={required(fullName)}
        />
        <TextField
          label={t("v11Client.guestEmail")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          maxLength={200}
        />
        <TextField
          label={t("v11Client.guestPhone")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={30}
          hint={t("v11Client.guestContactHint")}
          error={showErrors && contactMissing ? t("v11Client.guestContactHint") : undefined}
        />
      </Card>

      <Card>
        <AppText variant="heading">{t("v11Client.guestEmergencyTitle")}</AppText>
        <TextField
          label={t("v11Client.guestEmergencyName")}
          value={contactName}
          onChangeText={setContactName}
          autoComplete="off"
          maxLength={120}
          error={required(contactName)}
        />
        <TextField
          label={t("v11Client.guestEmergencyPhone")}
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
          autoComplete="off"
          maxLength={30}
          error={required(contactPhone)}
        />
      </Card>

      <Card>
        <AppText variant="heading">{t("v11Client.guestDogTitle")}</AppText>
        <DogFields value={dog} onChange={(patch) => setDog((prev) => ({ ...prev, ...patch }))} />
      </Card>

      {pending.length > 0 ? (
        <Card>
          <AppText variant="heading">{t("v11Client.guestDocumentsTitle")}</AppText>
          {pending.map((document) => (
            <View key={document.id} style={styles.document}>
              <Checkbox
                label={t("booking.documentAccept", { title: document.title, version: document.version })}
                checked={Boolean(accepted[document.id])}
                onChange={(checked) => setAccepted((prev) => ({ ...prev, [document.id]: checked }))}
              />
              <Button
                label={t("booking.documentRead")}
                variant="ghost"
                onPress={() => setOpenDocument(openDocument === document.id ? null : document.id)}
              />
              {openDocument === document.id ? (
                <AppText variant="caption" style={styles.documentBody}>
                  {document.body}
                </AppText>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {error ? (
        <AppText variant="bodyStrong" style={styles.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label={t("v11Client.guestSubmit")} loading={complete.isPending} onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  document: { gap: space.xs },
  documentBody: { padding: space.sm, backgroundColor: colors.cream, borderRadius: radius.sm },
  error: { color: colors.danger },
});
