import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";

import { useCreateRescueAccess, useRescueAccesses, useRevokeRescueAccess } from "@/api/admin-extra";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Segmented } from "@/components/segmented";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { appLink } from "@/lib/links";
import { colors, space } from "@/theme";
import { formatDateTime } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const DURATIONS = [2, 6, 24, 72];

/** Lien temporaire pour les services de secours : direct et fiche secours, en lecture seule (M9-04). */
export function RescueAccessCard() {
  const { t, tp } = useLanguage();
  const accesses = useRescueAccesses();
  const create = useCreateRescueAccess();
  const revoke = useRevokeRescueAccess();
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(6);

  const copy = async (token: string) => {
    const link = appLink(`rescue/${token}`);
    if (Platform.OS !== "web") {
      await Share.share({ message: link }).catch(() => undefined);
      return;
    }
    await Clipboard.setStringAsync(link);
    notify(t("adminExtra.rescueCopied"), "");
  };

  const submit = () =>
    create.mutate(
      { label: label.trim(), hours },
      {
        onSuccess: (row) => {
          setLabel("");
          if (row) void copy(row.token);
        },
        onError: (err) => notify(t("common.error"), toUserMessage(err)),
      },
    );

  const askRevoke = async (id: string) => {
    if (
      await confirm({
        title: t("adminExtra.rescueRevoke"),
        message: t("adminExtra.rescueRevokeConfirm"),
        confirmLabel: t("adminExtra.rescueRevoke"),
        destructive: true,
      })
    ) {
      revoke.mutate(id);
    }
  };

  return (
    <Card>
      <AppText variant="heading">{t("adminExtra.rescueTitle")}</AppText>
      <AppText variant="body">{t("adminExtra.rescueText")}</AppText>
      <TextField
        label={t("adminExtra.rescueLabel")}
        placeholder={t("adminExtra.rescueLabelPlaceholder")}
        value={label}
        onChangeText={setLabel}
        maxLength={120}
      />
      <AppText variant="bodyStrong">{t("adminExtra.rescueDuration")}</AppText>
      <Segmented
        accessibilityLabel={t("adminExtra.rescueDuration")}
        options={DURATIONS.map((value) => ({ value, label: tp("adminExtra.hours", value) }))}
        value={hours}
        onChange={setHours}
      />
      {/* Écart plus grand que celui des durées : le bouton ne se lit pas comme une cinquième option. */}
      <Button label={t("adminExtra.rescueCreate")} loading={create.isPending} onPress={submit} style={styles.create} />

      <AppText variant="heading" style={styles.activeTitle}>
        {t("adminExtra.rescueActiveTitle")}
      </AppText>
      {accesses.isLoading ? (
        <LoadingView />
      ) : accesses.isError ? (
        <ErrorView error={accesses.error} onRetry={() => void accesses.refetch()} />
      ) : (accesses.data ?? []).length === 0 ? (
        <AppText variant="body" style={styles.empty}>
          {t("adminExtra.rescueNone")}
        </AppText>
      ) : (
        (accesses.data ?? []).map((access) => (
          <View key={access.id} style={styles.access}>
            {access.label ? <AppText variant="bodyStrong">{access.label}</AppText> : null}
            <AppText variant="caption">
              {t("adminExtra.rescueUntil", { date: formatDateTime(access.expires_at) })}
            </AppText>
            <View style={styles.actions}>
              <Button
                label={Platform.OS === "web" ? t("adminExtra.rescueCopy") : t("adminExtra.rescueShare")}
                variant="secondary"
                onPress={() => void copy(access.token)}
                style={styles.action}
              />
              <Button
                label={t("adminExtra.rescueRevoke")}
                variant="dangerText"
                loading={revoke.isPending && revoke.variables === access.id}
                onPress={() => void askRevoke(access.id)}
                style={[styles.action, styles.revoke]}
              />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  create: { marginTop: space.sm },
  activeTitle: { marginTop: space.md },
  empty: { color: colors.inkSoft },
  // Deux boutons de même forme ; « Révoquer » en contour rouge, car l’action coupe l’accès des secours.
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  action: { flexGrow: 1, flexBasis: 140 },
  revoke: { borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.creamAlt },
  access: {
    gap: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
