import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { useDeleteAccount, useIsAdmin, useProfile } from "@/api/profile";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { LANGUAGES, useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { confirm, notify } from "@/lib/confirm";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { userId } = useAuth();
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const deleteAccount = useDeleteAccount();

  const onDelete = async () => {
    const ok = await confirm({
      title: t("account.deleteTitle"),
      message: t("account.deleteMessage"),
      confirmLabel: t("account.deleteConfirm"),
      destructive: true,
    });
    if (!ok) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => notify(t("account.deleted"), t("account.deletedText")),
      onError: (error) => notify(t("account.deleteFailed"), toUserMessage(error)),
    });
  };

  return (
    <Screen title={t("tabs.account")}>
      {userId ? (
        <Card>
          <AppText variant="heading">{profile.data?.full_name || t("account.welcome")}</AppText>
          <AppText variant="body">{profile.data?.email}</AppText>
        </Card>
      ) : (
        <Card>
          <AppText variant="heading">{t("account.noAccount")}</AppText>
          <AppText variant="body">{t("account.noAccountText")}</AppText>
          <Button label={t("account.signIn")} onPress={() => router.push("/sign-in")} />
        </Card>
      )}

      <View style={styles.language}>
        <AppText variant="bodyStrong">{t("account.language")}</AppText>
        <View style={styles.chips}>
          {LANGUAGES.map((option) => (
            <Chip
              key={option.code}
              label={option.label}
              selected={language === option.code}
              onPress={() => setLanguage(option.code)}
            />
          ))}
        </View>
      </View>

      <View>
        {userId ? (
          <>
            <ListRow
              label={t("account.myInfo")}
              detail={t("account.myInfoDetail")}
              onPress={() => router.push("/profile")}
            />
            <ListRow label={t("account.myDogs")} onPress={() => router.push("/dogs")} />
            {isAdmin ? (
              <ListRow
                label={t("account.admin")}
                detail={t("account.adminDetail")}
                onPress={() => router.push("/admin")}
              />
            ) : null}
          </>
        ) : null}
        <ListRow
          label={t("account.contact")}
          detail={env.contactEmail}
          onPress={() => void Linking.openURL(`mailto:${env.contactEmail}`)}
        />
        <ListRow
          label={t("account.website")}
          detail="freepaws.be"
          onPress={() => void Linking.openURL(env.websiteUrl)}
        />
        <ListRow label={t("account.legal")} onPress={() => router.push("/legal")} />
        {userId ? (
          <>
            <ListRow label={t("account.signOut")} onPress={() => void supabase.auth.signOut()} />
            <ListRow label={t("account.delete")} destructive onPress={() => void onDelete()} />
          </>
        ) : null}
      </View>

      <AppText variant="caption" style={styles.version}>
        FreePaws {Constants.expoConfig?.version ?? ""}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  language: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  version: { textAlign: "center", marginTop: space.lg },
});
