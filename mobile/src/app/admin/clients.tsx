import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { type ClientRow, fetchClientsForExport, isActiveSanction, type Sanction, useClients } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { BadgeRow, keepTogether } from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import { shareTextFile } from "@/lib/share-file";
import { colors, space } from "@/theme";
import { toCsv } from "@/utils/csv";
import { toIsoDay } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

export default function AdminClientsRoute() {
  return (
    <AdminGuard>
      <Clients />
    </AdminGuard>
  );
}

function useDebounced(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Clients() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const clients = useClients(term);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = (await fetchClientsForExport()) ?? [];
      const csv = toCsv(
        [
          t("adminClients.csvName"),
          t("adminClients.csvEmail"),
          t("adminClients.csvPhone"),
          t("adminClients.csvRole"),
          t("adminClients.csvBirthDate"),
          t("adminClients.csvEmergencyName"),
          t("adminClients.csvEmergencyPhone"),
          t("adminClients.csvInsurer"),
          t("adminClients.csvInsuranceUntil"),
          t("adminClients.csvCreatedAt"),
          t("adminClients.csvDogs"),
        ],
        rows.map((row) => [
          row.full_name,
          row.email,
          row.phone,
          row.role === "admin" ? t("adminClients.roleAdmin") : t("adminClients.roleClient"),
          row.birth_date,
          row.emergency_contact_name,
          row.emergency_contact_phone,
          row.insurance_company,
          row.insurance_valid_until,
          toIsoDay(row.created_at),
          (row.dogs ?? []).map((dog) => dog.name).join(", "),
        ]),
      );
      await shareTextFile("clients.csv", csv, "text/csv");
    } catch (error) {
      notify(t("adminClients.exportFailed"), toUserMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen underHeader refreshing={clients.isRefetching} onRefresh={() => void clients.refetch()}>
      <TextField
        label={t("adminClients.searchLabel")}
        placeholder={t("adminClients.searchHint")}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        maxLength={80}
      />

      {clients.isLoading ? (
        <LoadingView />
      ) : clients.isError ? (
        <ErrorView error={clients.error} onRetry={() => void clients.refetch()} />
      ) : !clients.data?.length ? (
        <EmptyView
          title={t("adminClients.noClients")}
          message={
            term.trim() ? t("adminClients.noClientsSearch", { query: term.trim() }) : t("adminClients.noClientsText")
          }
        />
      ) : (
        clients.data.map((client) => <ClientCard key={client.id} client={client} />)
      )}

      <Button
        label={t("adminClients.export")}
        variant="secondary"
        loading={exporting}
        onPress={() => void exportCsv()}
        style={styles.export}
      />
    </Screen>
  );
}

function ClientCard({ client }: { client: ClientRow }) {
  const { t, tp } = useLanguage();
  // Cast : l’embed « sanctions » est typé en erreur tant que la relation n’est pas précisée côté API.
  const sanctions = (client.sanctions ?? []) as unknown as Pick<Sanction, "level" | "starts_at" | "ends_at">[];
  const active = sanctions.filter((sanction) => isActiveSanction(sanction));
  const banned = active.some((sanction) => sanction.level === "ban");
  const suspended = !banned && active.some((sanction) => sanction.level === "suspension");
  const dogs = client.dogs ?? [];
  const protocol = dogs.some((dog) => dog.protocol);
  const name = client.full_name?.trim() || client.email;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => router.push({ pathname: "/admin/client/[id]", params: { id: client.id } })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card>
        <View style={styles.head}>
          <AppText variant="heading" style={styles.name}>
            {name}
          </AppText>
          <AppText style={styles.chevron}>›</AppText>
        </View>
        {client.full_name?.trim() ? (
          <AppText variant="caption" style={styles.wrap}>
            {client.email}
          </AppText>
        ) : null}
        {client.phone ? <AppText variant="caption">{keepTogether(client.phone)}</AppText> : null}
        <BadgeRow>
          {client.role === "admin" ? <Badge label={t("adminClients.badgeAdmin")} /> : null}
          {banned ? <Badge label={t("adminClients.badgeBanned")} tone="danger" /> : null}
          {suspended ? <Badge label={t("adminClients.badgeSuspended")} tone="danger" /> : null}
          <Badge label={tp("adminClients.dogs", dogs.length)} />
          {protocol ? <Badge label={t("adminClients.badgeProtocol")} tone="warning" /> : null}
        </BadgeRow>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  export: { alignSelf: "flex-start" },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  name: { flex: 1 },
  wrap: { flexShrink: 1 },
  chevron: { fontSize: 24, lineHeight: 26, color: colors.inkSoft },
});
