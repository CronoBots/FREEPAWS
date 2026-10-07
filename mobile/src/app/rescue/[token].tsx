import { useLocalSearchParams } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { useRescueLive } from "@/api/admin-extra";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { LivePlayer } from "@/components/live-player";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";

/** Page des services de secours (lien temporaire, sans compte) : direct et fiche secours. */
export default function RescueRoute() {
  const { t } = useLanguage();
  const { token } = useLocalSearchParams<{ token: string }>();
  const live = useRescueLive(token);

  if (live.isLoading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }
  if (live.isError) {
    return (
      <Screen>
        <ErrorView error={live.error} onRetry={() => void live.refetch()} />
      </Screen>
    );
  }
  if (!live.data || live.data.mode !== "rescue") {
    return (
      <Screen>
        <EmptyView title={t("adminExtra.rescuePageTitle")} message={t("adminExtra.rescueDenied")} />
      </Screen>
    );
  }

  const { streams, rescueInfo, label } = live.data;
  return (
    <Screen
      heading={t("adminExtra.rescuePageTitle")}
      refreshing={live.isRefetching}
      onRefresh={() => void live.refetch()}
    >
      {label ? <AppText variant="bodyStrong">{label}</AppText> : null}
      <Button label={t("adminExtra.call112")} onPress={() => void Linking.openURL("tel:112")} />
      {rescueInfo?.trim() ? (
        <Card>
          <AppText variant="heading">{t("adminExtra.rescueInfoTitle")}</AppText>
          <AppText variant="body" selectable>
            {rescueInfo.trim()}
          </AppText>
        </Card>
      ) : null}
      {streams.length === 0 ? (
        <Card>
          <AppText variant="body">{t("adminExtra.rescueNoCamera")}</AppText>
        </Card>
      ) : (
        <View style={styles.streams}>
          {streams.map((stream) => (
            <LivePlayer key={stream.id} url={stream.url} label={stream.name} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  streams: { gap: space.md, borderColor: colors.line },
});
