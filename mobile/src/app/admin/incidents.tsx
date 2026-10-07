import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useIncidents, usePeopleAndDogs } from "@/api/admin-park";
import { incidentKindKey } from "@/components/admin/safety/incident-kinds";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { formatDateTime } from "@/utils/dates";

/** Espace insécable après chaque mot court : « Art. 4 (essai) » ne se coupe pas après « Art. ». */
function bindShortWords(text: string) {
  const words = text.split(" ");
  return words
    .map((word, index) => (index === words.length - 1 ? word : word + (word.length <= 5 ? "\u00a0" : " ")))
    .join("");
}

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
  const personIds = [...new Set((incidents.data ?? []).flatMap((incident) => incident.person_ids))].sort();
  const names = usePeopleAndDogs(personIds, []);
  const nameOf = (pid: string) => {
    const row = names.data?.people?.find((person) => person.id === pid);
    return row ? row.full_name?.trim() || row.email || t("adminSafety.unnamed") : null;
  };
  const openIncident = (id: string) => router.push({ pathname: "/admin/incident/[id]", params: { id } });

  return (
    <Screen underHeader refreshing={incidents.isRefetching} onRefresh={() => void incidents.refetch()}>
      <Button label={t("adminSafety.newIncident")} onPress={() => openIncident("new")} style={styles.new} />
      {incidents.isLoading ? (
        <LoadingView />
      ) : incidents.isError ? (
        <ErrorView error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : !incidents.data?.length ? (
        <EmptyView title={t("adminSafety.noIncidents")} />
      ) : (
        incidents.data.map((incident) => {
          const kindLabel = t(incidentKindKey(incident.kind));
          const when = formatDateTime(incident.occurred_at);
          const people = incident.person_ids.map(nameOf);
          // Noms connus : on les affiche ; sinon (chargement), le nombre de personnes.
          const peopleText = !people.length
            ? null
            : people.every(Boolean)
              ? people.join(", ")
              : tp("adminSafety.people", people.length);
          const details = [
            peopleText,
            incident.photo_paths.length ? tp("adminSafety.photos", incident.photo_paths.length) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Pressable
              key={incident.id}
              accessibilityRole="button"
              accessibilityLabel={`${kindLabel}, ${when}`}
              onPress={() => openIncident(incident.id)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {/* Chevron centré verticalement, comme dans la fiche client. */}
              <Card style={styles.card}>
                <View style={styles.body}>
                  <View style={styles.head}>
                    <Badge label={kindLabel} tone={incident.kind === "bite" ? "danger" : "warning"} />
                    <AppText variant="caption" style={styles.flex}>
                      {when}
                    </AppText>
                  </View>
                  <AppText variant="body" numberOfLines={3}>
                    {incident.description.trim() || t("adminSafety.noDescription")}
                  </AppText>
                  {details ? <AppText variant="caption">{details}</AppText> : null}
                  {/* Référence du règlement sur sa propre ligne ; un mot court (« Art. », « 4 ») reste lié au suivant. */}
                  {incident.rule_reference ? (
                    <AppText variant="caption">{bindShortWords(incident.rule_reference)}</AppText>
                  ) : null}
                </View>
                <AppText style={styles.chevron}>›</AppText>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.sm },
  body: { flex: 1, gap: space.sm },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  pressed: { opacity: 0.7 },
  flex: { flexGrow: 1, flexShrink: 1 },
  chevron: { fontSize: 24, lineHeight: 26, color: colors.inkSoft },
  new: { alignSelf: "flex-start" },
});
