import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { useRescueAccessCheck, useRescueLive } from "@/api/admin-extra";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { Screen } from "@/components/screen";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, fonts, radius, space } from "@/theme";

/**
 * Page des services de secours (lien temporaire, sans compte) : bouton 112, fiche secours et direct.
 * Le 112 est toujours affiché ; la fiche dépend seulement de la validité du lien (lue en base), et une
 * panne de la vidéo reste locale au bloc du direct.
 */
export default function RescueRoute() {
  const { t } = useLanguage();
  const { token } = useLocalSearchParams<{ token: string }>();
  const access = useRescueAccessCheck(token);
  const valid = access.data?.valid === true;
  const live = useRescueLive(token, valid);

  const refresh = () => {
    void access.refetch();
    if (valid) void live.refetch();
  };

  return (
    <Screen underHeader refreshing={access.isRefetching || live.isRefetching} onRefresh={refresh}>
      <Call112 />

      {access.isLoading ? (
        <LoadingView />
      ) : access.isError ? (
        <ErrorView error={access.error} onRetry={() => void access.refetch()} />
      ) : !valid ? (
        <DeniedCard />
      ) : (
        <>
          {access.data?.label ? <AppText variant="bodyStrong">{access.data.label}</AppText> : null}
          {access.data?.rescueInfo ? (
            <Card>
              <AppText variant="heading">{t("adminExtra.rescueInfoTitle")}</AppText>
              <AppText variant="body" selectable>
                {access.data.rescueInfo}
              </AppText>
            </Card>
          ) : null}

          <AppText variant="heading">{t("adminExtra.rescueLiveTitle")}</AppText>
          {live.isLoading ? (
            <LoadingView />
          ) : live.isError ? (
            <Card>
              <AppText variant="body">{t("adminExtra.rescueVideoUnavailable")}</AppText>
              <Button
                label={t("adminExtra.rescueVideoRetry")}
                variant="secondary"
                loading={live.isRefetching}
                onPress={() => void live.refetch()}
              />
            </Card>
          ) : live.data?.mode !== "rescue" ? (
            // Le lien a expiré entre les deux vérifications : la prochaine lecture en base le dira.
            <DeniedCard />
          ) : live.data.streams.length === 0 ? (
            <Card>
              <AppText variant="body">{t("adminExtra.rescueNoCamera")}</AppText>
            </Card>
          ) : (
            <View style={styles.streams}>
              {live.data.streams.map((stream) => (
                <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

/** Lien expiré ou révoqué : carte en ton d’avertissement, avec la marche à suivre. */
function DeniedCard() {
  const { t } = useLanguage();
  return (
    <Card style={styles.denied} accessibilityRole="alert">
      <View style={styles.deniedHead}>
        <Ionicons name="alert-circle" size={24} color={colors.brassText} />
        <AppText variant="bodyStrong" style={styles.deniedText}>
          {t("adminExtra.rescueDenied")}
        </AppText>
      </View>
      <AppText variant="body">{t("adminExtra.rescueDeniedHelp")}</AppText>
    </Card>
  );
}

function Call112() {
  const { t } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("adminExtra.call112")}
      onPress={() => void Linking.openURL("tel:112").catch(() => undefined)}
      style={({ pressed }) => [styles.call112, pressed && styles.pressed]}
    >
      <Ionicons name="call" size={26} color={colors.white} />
      <AppText style={styles.call112Label}>{t("adminExtra.call112")}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  streams: { gap: space.md },
  denied: { backgroundColor: colors.reservedSoft, borderColor: colors.brass },
  deniedHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  deniedText: { flex: 1, color: colors.ink },
  call112: {
    minHeight: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  call112Label: { fontFamily: fonts.sansSemiBold, fontSize: 19, lineHeight: 25, color: colors.white },
  pressed: { opacity: 0.82 },
});
