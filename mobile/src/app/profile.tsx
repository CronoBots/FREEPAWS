import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { useProfile, useUpdateProfile } from "@/api/profile";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { notify } from "@/lib/confirm";
import type { Tables } from "@/types/database";
import { toUserMessage } from "@/utils/errors";

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

function ProfileForm({ profile, welcome }: { profile: Tables<"profiles">; welcome: boolean }) {
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [nameError, setNameError] = useState<string>();

  const save = () => {
    if (fullName.trim().length < 2) {
      setNameError("Indiquez votre nom pour que nous puissions vous accueillir.");
      return;
    }
    setNameError(undefined);
    update.mutate(
      { full_name: fullName.trim(), phone: phone.trim() || null },
      {
        onSuccess: () => (router.canGoBack() ? router.back() : router.replace("/")),
        onError: (error) => notify("Enregistrement impossible", toUserMessage(error)),
      },
    );
  };

  return (
    <Screen underHeader>
      {welcome ? (
        <AppText variant="body">Bienvenue ! Encore une petite étape : comment pouvons-nous vous appeler ?</AppText>
      ) : null}
      <TextField
        label="Nom et prénom"
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        textContentType="name"
        maxLength={120}
        error={nameError}
      />
      <TextField
        label="Téléphone (facultatif)"
        hint="Utile pour vous prévenir en cas d’imprévu."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={30}
      />
      <AppText variant="caption">Email : {profile.email}</AppText>
      <Button label="Enregistrer" loading={update.isPending} onPress={save} />
    </Screen>
  );
}
