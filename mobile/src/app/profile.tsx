import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useProfile, useUpdateProfile } from "@/api/profile";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { isValidIsoDay, ProofField, todayIso, validityState } from "@/components/fiche/form-parts";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/confirm";
import { type PickedFile, removeStoredFile, uploadFile } from "@/lib/files";
import { space } from "@/theme";
import type { Tables } from "@/types/database";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";
import { useLanguage } from "@/i18n";

export default function ProfileRoute() {
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const profile = useProfile();

  if (profile.data) return <ProfileForm profile={profile.data} welcome={welcome === "1"} />;
  return (
    <Screen underHeader>
      {profile.isError ? <ErrorView error={profile.error} onRetry={() => void profile.refetch()} /> : <LoadingView />}
    </Screen>
  );
}

type Errors = { name?: string; birthDate?: string; emergency?: string; insuranceDate?: string };

function ProfileForm({ profile, welcome }: { profile: Tables<"profiles">; welcome: boolean }) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? "");
  const [emergencyName, setEmergencyName] = useState(profile.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(profile.emergency_contact_phone ?? "");
  const [company, setCompany] = useState(profile.insurance_company ?? "");
  const [policy, setPolicy] = useState(profile.insurance_policy ?? "");
  const [validUntil, setValidUntil] = useState(profile.insurance_valid_until ?? "");
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const save = async () => {
    const next: Errors = {};
    if (fullName.trim().length < 2) next.name = t("profile.nameError");
    if (birthDate && (!isValidIsoDay(birthDate) || birthDate > todayIso())) next.birthDate = t("fiche.birthDateError");
    if (Boolean(emergencyName.trim()) !== Boolean(emergencyPhone.trim()))
      next.emergency = t("fiche.emergencyIncomplete");
    if (validUntil && !isValidIsoDay(validUntil)) next.insuranceDate = t("fiche.insuranceValidUntilError");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    let proofPath = profile.insurance_proof_path;
    if (proof && userId) {
      setUploading(true);
      try {
        proofPath = await uploadFile("proofs", userId, proof);
      } catch (error) {
        setUploading(false);
        notify(t("profile.saveFailed"), toUserMessage(error));
        return;
      }
      setUploading(false);
    }

    update.mutate(
      {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        insurance_company: company.trim() || null,
        insurance_policy: policy.trim() || null,
        insurance_valid_until: validUntil || null,
        insurance_proof_path: proofPath,
      },
      {
        onSuccess: () => {
          // L’ancien justificatif remplacé n’est plus utile.
          if (proof && profile.insurance_proof_path && proofPath !== profile.insurance_proof_path) {
            void removeStoredFile("proofs", profile.insurance_proof_path).catch(() => undefined);
          }
          setProof(null);
          if (router.canGoBack()) router.back();
          else router.replace("/");
        },
        onError: (error) => notify(t("profile.saveFailed"), toUserMessage(error)),
      },
    );
  };

  return (
    <Screen underHeader>
      {welcome ? <AppText variant="body">{t("profile.welcome")}</AppText> : null}
      <Card>
        <AppText variant="body">{t("fiche.intro")}</AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionYou")}
        </AppText>
        <TextField
          label={t("profile.name")}
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
          maxLength={120}
          error={errors.name}
        />
        <TextField
          label={t("profile.phone")}
          hint={t("profile.phoneHint")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={30}
        />
        <TextField
          label={t("fiche.birthDate")}
          hint={t("fiche.birthDateHint")}
          placeholder={t("fiche.datePlaceholder")}
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numbers-and-punctuation"
          autoComplete="birthdate-full"
          maxLength={10}
          error={errors.birthDate}
        />
        <AppText variant="caption">{t("profile.email", { email: profile.email })}</AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionEmergency")}
        </AppText>
        <AppText variant="caption">{t("fiche.emergencyHint")}</AppText>
        <TextField
          label={t("fiche.emergencyName")}
          value={emergencyName}
          onChangeText={setEmergencyName}
          maxLength={120}
        />
        <TextField
          label={t("fiche.emergencyPhone")}
          value={emergencyPhone}
          onChangeText={setEmergencyPhone}
          keyboardType="phone-pad"
          maxLength={30}
          error={errors.emergency}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t("fiche.sectionInsurance")}
        </AppText>
        <InsuranceBadge profile={profile} />
        <TextField label={t("fiche.insuranceCompany")} value={company} onChangeText={setCompany} maxLength={120} />
        <TextField label={t("fiche.insurancePolicy")} value={policy} onChangeText={setPolicy} maxLength={60} />
        <TextField
          label={t("fiche.insuranceValidUntil")}
          placeholder={t("fiche.datePlaceholder")}
          value={validUntil}
          onChangeText={setValidUntil}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={errors.insuranceDate}
        />
        <ProofField
          label={t("fiche.insuranceProof")}
          storedPath={profile.insurance_proof_path}
          picked={proof}
          onPick={setProof}
        />
      </View>

      <Button label={t("common.save")} loading={uploading || update.isPending} onPress={() => void save()} />
    </Screen>
  );
}

/** État de l’assurance enregistrée (pas de la saisie en cours). */
function InsuranceBadge({ profile }: { profile: Tables<"profiles"> }) {
  const { t } = useLanguage();
  const until = profile.insurance_valid_until;
  if (!profile.insurance_company || !until) return <Badge tone="danger" label={t("fiche.insuranceMissing")} />;
  const date = formatDate(until);
  switch (validityState(until)) {
    case "expired":
      return <Badge tone="danger" label={t("fiche.insuranceExpired", { date })} />;
    case "expiring":
      return <Badge tone="warning" label={t("fiche.insuranceExpiring", { date })} />;
    default:
      return <Badge tone="success" label={t("fiche.insuranceValid", { date })} />;
  }
}

const styles = StyleSheet.create({
  section: { gap: space.md },
});
