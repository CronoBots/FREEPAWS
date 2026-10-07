import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useIncidents } from "@/api/admin-park";
import { incidentKindKey } from "@/components/admin/safety/incident-kinds";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { space } from "@/theme";
import { formatDate, formatTime } from "@/utils/dates";

export default function AdminIncidentsRoute() {
  return (
    <AdminGuard>
      <Incidents />
    </AdminGuard>
  );
}

function Incidents() {
  const { t, tp } = useLanguage();
  const incidents = useIncidents();
  const openIncident = (id: string) => router.push({ pathname: "/admin/incident/[id]", params: { id } });

  return (
    <Screen underHeader refreshing={incidents.isRefetching} onRefresh={() => void incidents.refetch()}>
      <Button label={t("adminSafety.newIncident")} onPress={() => openIncident("new")} />
      {incidents.isLoading ? (
        <LoadingView />
      ) : incidents.isError ? (
        <ErrorView error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : !incidents.data?.length ? (
        <EmptyView title={t("adminSafety.noIncidents")} />
      ) : (
        incidents.data.map((incident) => {
          const kindLabel = t(incidentKindKey(incident.kind));
          const when = `${formatDate(incident.occurred_at)}, ${formatTime(incident.occurred_at)}`;
          return (
            <Pressable
              key={incident.id}
              accessibilityRole="button"
              accessibilityLabel={`${kindLabel}, ${when}`}
              onPress={() => openIncident(incident.id)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card>
                <View style={styles.head}>
                  <Badge label={kindLabel} tone={incident.kind === "bite" ? "danger" : "warning"} />
                  <AppText variant="caption">{when}</AppText>
                </View>
                <AppText variant="body" numberOfLines={3}>
                  {incident.description.trim() || t("adminSafety.noDescription")}
                </AppText>
                <AppText variant="caption">
                  {[
                    incident.person_ids.length ? tp("adminSafety.people", incident.person_ids.length) : null,
                    incident.photo_paths.length ? tp("adminSafety.photos", incident.photo_paths.length) : null,
                    incident.rule_reference,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  pressed: { opacity: 0.7 },
});
