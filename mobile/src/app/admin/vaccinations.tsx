import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { usePendingVaccinations, useReviewVaccination } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { dayDate, ErrorText, openProof, validity, vaccineName } from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

type Pending = NonNullable<ReturnType<typeof usePendingVaccinations>["data"]>[number];

export default function AdminVaccinationsRoute() {
  return (
    <AdminGuard>
      <Vaccinations />
    </AdminGuard>
  );
}

function Vaccinations() {
  const { t } = useLanguage();
  const pending = usePendingVaccinations();

  return (
    <Screen underHeader refreshing={pending.isRefetching} onRefresh={() => void pending.refetch()}>
      {pending.isLoading ? (
        <LoadingView />
      ) : pending.isError ? (
        <ErrorView error={pending.error} onRetry={() => void pending.refetch()} />
      ) : !pending.data?.length ? (
        <EmptyView title={t("adminClients.pendingEmpty")} message={t("adminClients.pendingEmptyText")} />
      ) : (
        pending.data.map((item) => <PendingCard key={item.id} item={item} />)
      )}
    </Screen>
  );
}

function PendingCard({ item }: { item: Pending }) {
  const { t } = useLanguage();
  const review = useReviewVaccination();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const owner = item.dog?.owner;
  const ownerName = owner ? owner.full_name?.trim() || owner.email : null;
  const expired = validity(item.valid_until) === "expired";

  const submit = async (status: "validated" | "rejected") => {
    setError(null);
    // Valider ouvre l’accès au parc : sans justificatif, on demande confirmation.
    if (status === "validated" && !item.proof_path) {
      const ok = await confirm({
        title: t("adminClients.noProofTitle"),
        message: t("adminClients.noProofMessage"),
        confirmLabel: t("adminClients.validate"),
      });
      if (!ok) return;
    }
    review.mutate(
      { id: item.id, status, note: status === "rejected" ? note.trim() || null : null },
      { onError: (err) => setError(toUserMessage(err)) },
    );
  };

  return (
    <Card>
      <AppText variant="heading">{vaccineName(item.vaccine)}</AppText>
      <AppText variant="bodyStrong">{[item.dog?.name, item.dog?.breed].filter(Boolean).join(" · ")}</AppText>
      {owner && ownerName ? (
        <View>
          <AppText variant="caption">{t("adminClients.owner")}</AppText>
          <ListRow
            label={ownerName}
            last
            onPress={() => router.push({ pathname: "/admin/client/[id]", params: { id: owner.id } })}
          />
        </View>
      ) : null}
      <AppText variant="body">{t("adminClients.validFrom", { date: formatDate(dayDate(item.vaccinated_on)) })}</AppText>
      <View style={styles.row}>
        <AppText variant="body">
          {t("adminClients.validUntil", { date: formatDate(dayDate(item.valid_until)) })}
        </AppText>
        {expired ? <Badge label={t("adminClients.statusExpired")} tone="danger" /> : null}
      </View>
      {item.proof_path ? (
        <Button label={t("adminClients.proof")} variant="secondary" onPress={() => openProof(item.proof_path!)} />
      ) : (
        <View style={styles.row}>
          <Badge label={t("adminClients.noProofBadge")} tone="warning" />
          <AppText variant="caption">{t("adminClients.noProof")}</AppText>
        </View>
      )}

      {rejecting ? (
        <View style={styles.reject}>
          <TextField
            label={t("adminClients.rejectNote")}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
          />
          <ErrorText>{error}</ErrorText>
          <View style={styles.actions}>
            <Button
              label={t("common.cancel")}
              variant="ghost"
              style={styles.action}
              disabled={review.isPending}
              onPress={() => setRejecting(false)}
            />
            <Button
              label={t("adminClients.rejectConfirm")}
              variant="danger"
              style={styles.action}
              loading={review.isPending}
              onPress={() => void submit("rejected")}
            />
          </View>
        </View>
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          <View style={styles.actions}>
            <Button
              label={t("adminClients.reject")}
              variant="secondary"
              style={styles.action}
              disabled={review.isPending}
              onPress={() => setRejecting(true)}
            />
            <Button
              label={t("adminClients.validate")}
              style={styles.action}
              loading={review.isPending}
              onPress={() => void submit("validated")}
            />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  reject: {
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: { flexGrow: 1, flexBasis: 130 },
});
