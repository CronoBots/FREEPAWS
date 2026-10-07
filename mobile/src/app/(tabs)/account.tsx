import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { exportMyData } from "@/api/park-profile";
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
import { shareTextFile } from "@/lib/share-file";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { userId } = useAuth();
  const profile = useProfile();
  const isAdmin = useIsAdmin();
  const deleteAccount = useDeleteAccount();
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportMyData();
      await shareTextFile("freepaws-mes-donnees.json", JSON.stringify(data, null, 2), "application/json");
    } catch (error) {
      notify(t("fiche.exportFailed"), toUserMessage(error));
    } finally {
      setExporting(false);
    }
  };

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
          <AppText variant="body" numberOfLines={1} ellipsizeMode="middle">
            {profile.data?.email}
          </AppText>
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

      {userId && isAdmin ? (
        <View>
          <AppText variant="eyebrow" style={styles.sectionTitle}>
            {t("account.sectionAdmin")}
          </AppText>
          <ListRow
            label={t("account.admin")}
            detail={t("account.adminDetail")}
            onPress={() => router.push("/admin")}
            last
          />
        </View>
      ) : null}

      {userId ? (
        <View>
          <AppText variant="eyebrow" style={styles.sectionTitle}>
            {t("account.sectionAccount")}
          </AppText>
          <ListRow
            label={t("account.myInfo")}
            detail={t("fiche.myInfoDetail")}
            onPress={() => router.push("/profile")}
          />
          <ListRow label={t("account.myDogs")} onPress={() => router.push("/dogs")} />
          <ListRow
            label={t("fiche.export")}
            detail={exporting ? t("fiche.exportLoading") : t("fiche.exportDetail")}
            chevron={false}
            onPress={() => void onExport()}
            last
          />
        </View>
      ) : null}

      <View>
        <AppText variant="eyebrow" style={styles.sectionTitle}>
          {t("account.sectionHelp")}
        </AppText>
        <ListRow
          label={t("account.contact")}
          detail={env.contactEmail}
          external
          accessibilityHint={t("account.externalLink")}
          onPress={() => void Linking.openURL(`mailto:${env.contactEmail}`)}
        />
        <ListRow
          label={t("account.website")}
          detail="freepaws.be"
          external
          accessibilityHint={t("account.externalLink")}
          onPress={() => void Linking.openURL(env.websiteUrl)}
        />
        <ListRow label={t("account.legal")} onPress={() => router.push("/legal")} last />
      </View>

      {userId ? (
        <View>
          <ListRow label={t("account.signOut")} chevron={false} onPress={() => void supabase.auth.signOut()} />
          <ListRow label={t("account.delete")} destructive onPress={() => void onDelete()} last />
        </View>
      ) : null}

      <AppText variant="caption" style={styles.version}>
        FreePaws {Constants.expoConfig?.version ?? ""}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  language: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sectionTitle: { marginBottom: space.xs },
  version: { textAlign: "center", marginTop: space.lg },
});
