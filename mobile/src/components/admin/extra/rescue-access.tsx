import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";

import { useCreateRescueAccess, useRescueAccesses, useRevokeRescueAccess } from "@/api/admin-extra";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { appLink } from "@/lib/links";
import { colors, space } from "@/theme";
import { formatDate, formatTime } from "@/utils/dates";
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
      <TextField label={t("adminExtra.rescueLabel")} value={label} onChangeText={setLabel} maxLength={120} />
      <AppText variant="bodyStrong">{t("adminExtra.rescueDuration")}</AppText>
      <View style={styles.chips}>
        {DURATIONS.map((value) => (
          <Chip
            key={value}
            label={tp("adminExtra.hours", value)}
            selected={hours === value}
            onPress={() => setHours(value)}
          />
        ))}
      </View>
      <Button label={t("adminExtra.rescueCreate")} loading={create.isPending} onPress={submit} />

      {accesses.isLoading ? (
        <LoadingView />
      ) : accesses.isError ? (
        <ErrorView error={accesses.error} onRetry={() => void accesses.refetch()} />
      ) : (accesses.data ?? []).length === 0 ? (
        <AppText variant="caption">{t("adminExtra.rescueNone")}</AppText>
      ) : (
        (accesses.data ?? []).map((access) => (
          <View key={access.id} style={styles.access}>
            {access.label ? <AppText variant="bodyStrong">{access.label}</AppText> : null}
            <AppText variant="caption">
              {t("adminExtra.rescueUntil", {
                date: formatDate(access.expires_at),
                time: formatTime(access.expires_at),
              })}
            </AppText>
            <View style={styles.chips}>
              <Button
                label={Platform.OS === "web" ? t("adminExtra.rescueCopy") : t("adminExtra.rescueShare")}
                variant="secondary"
                onPress={() => void copy(access.token)}
              />
              <Button label={t("adminExtra.rescueRevoke")} variant="ghost" onPress={() => void askRevoke(access.id)} />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  access: {
    gap: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
