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

function ProfileForm({ profile, welcome }: { profile: Tables<"profiles">; welcome: boolean }) {
  const { t } = useLanguage();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [nameError, setNameError] = useState<string>();

  const save = () => {
    if (fullName.trim().length < 2) {
      setNameError(t("profile.nameError"));
      return;
    }
    setNameError(undefined);
    update.mutate(
      { full_name: fullName.trim(), phone: phone.trim() || null },
      {
        onSuccess: () => (router.canGoBack() ? router.back() : router.replace("/")),
        onError: (error) => notify(t("profile.saveFailed"), toUserMessage(error)),
      },
    );
  };

  return (
    <Screen underHeader>
      {welcome ? <AppText variant="body">{t("profile.welcome")}</AppText> : null}
      <TextField
        label={t("profile.name")}
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        textContentType="name"
        maxLength={120}
        error={nameError}
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
      <AppText variant="caption">{t("profile.email", { email: profile.email })}</AppText>
      <Button label={t("common.save")} loading={update.isPending} onPress={save} />
    </Screen>
  );
}
