import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { isActiveSanction, type Sanction, type SanctionLevel, useAddSanction, useEndSanction } from "@/api/admin-park";
import { BadgeRow, ErrorText, Section, todayIso } from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { type TranslationKey, useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import { colors, space } from "@/theme";
import { brusselsDateTime, formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

const LEVELS: { level: SanctionLevel; key: TranslationKey }[] = [
  { level: "warning", key: "adminClients.levelWarning" },
  { level: "suspension", key: "adminClients.levelSuspension" },
  { level: "ban", key: "adminClients.levelBan" },
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function ClientSanctions({ userId, sanctions }: { userId: string; sanctions: Sanction[] }) {
  const { t } = useLanguage();
  return (
    <Section title={t("adminClients.sanctions")}>
      {sanctions.length === 0 ? <AppText variant="body">{t("adminClients.noSanctions")}</AppText> : null}
      {sanctions.map((sanction) => (
        <SanctionLine key={sanction.id} sanction={sanction} />
      ))}
      <SanctionForm userId={userId} />
    </Section>
  );
}

function SanctionLine({ sanction }: { sanction: Sanction }) {
  const { t } = useLanguage();
  const end = useEndSanction();
  const active = isActiveSanction(sanction);
  const level = LEVELS.find((item) => item.level === sanction.level);

  const lift = async () => {
    const ok = await confirm({
      title: t("adminClients.liftTitle"),
      message: t("adminClients.liftMessage"),
      confirmLabel: t("adminClients.lift"),
    });
    if (!ok) return;
    end.mutate(sanction.id, { onError: (err) => notify(t("adminClients.saveFailed"), toUserMessage(err)) });
  };

  return (
    <View style={styles.line}>
      <BadgeRow>
        <Badge
          label={level ? t(level.key) : sanction.level}
          tone={sanction.level === "warning" ? "warning" : "danger"}
        />
        {active ? <Badge label={t("adminClients.sanctionActive")} tone="danger" /> : null}
      </BadgeRow>
      <AppText variant="body" style={styles.reason}>
        {sanction.reason}
      </AppText>
      <AppText variant="caption">
        {[
          t("adminClients.sanctionFrom", { date: formatDate(sanction.starts_at) }),
          sanction.level === "warning"
            ? null
            : sanction.ends_at
              ? t("adminClients.sanctionUntil", { date: formatDate(sanction.ends_at) })
              : t("adminClients.sanctionOpenEnded"),
        ]
          .filter(Boolean)
          .join(" · ")}
      </AppText>
      {active ? (
        <Button
          label={t("adminClients.lift")}
          variant="secondary"
          loading={end.isPending}
          onPress={() => void lift()}
        />
      ) : null}
    </View>
  );
}

function SanctionForm({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const add = useAddSanction();
  const [level, setLevel] = useState<SanctionLevel>("warning");
  const [reason, setReason] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!reason.trim()) return setError(t("adminClients.reasonRequired"));
    let endsAt: string | null = null;
    if (level === "suspension" && endsOn) {
      const date = DATE.test(endsOn) ? brusselsDateTime(endsOn, "23:59") : null;
      if (!date || endsOn < todayIso()) return setError(t("adminClients.dateError"));
      endsAt = date.toISOString();
    }
    if (level === "ban") {
      const ok = await confirm({
        title: t("adminClients.banTitle"),
        message: t("adminClients.banMessage"),
        confirmLabel: t("adminClients.banConfirm"),
        destructive: true,
      });
      if (!ok) return;
    }
    add.mutate(
      { user_id: userId, level, reason: reason.trim(), ends_at: endsAt, incident_id: null },
      {
        onSuccess: () => {
          setReason("");
          setEndsOn("");
          setLevel("warning");
          notify(t("adminClients.sanctionAdded"), "");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <View style={styles.form}>
      <AppText variant="bodyStrong">{t("adminClients.newSanction")}</AppText>
      <View style={styles.chips}>
        {LEVELS.map((item) => (
          <Chip
            key={item.level}
            label={t(item.key)}
            selected={level === item.level}
            onPress={() => setLevel(item.level)}
          />
        ))}
      </View>
      <TextField label={t("adminClients.reason")} value={reason} onChangeText={setReason} multiline maxLength={1000} />
      {level === "suspension" ? (
        <TextField
          label={t("adminClients.endsOn")}
          hint={t("adminClients.endsOnHint")}
          value={endsOn}
          onChangeText={setEndsOn}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button
        label={t("adminClients.addSanction")}
        variant={level === "ban" ? "danger" : "primary"}
        loading={add.isPending}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  reason: { color: colors.ink },
  form: { gap: space.sm, paddingTop: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
