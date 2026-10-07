import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { isActiveSanction, type Sanction, type SanctionLevel, useAddSanction, useEndSanction } from "@/api/admin-park";
import { BadgeRow, ErrorText, Section, todayIso } from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { DateField } from "@/components/date-field";
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
/** Incident à l’origine de la sanction (ouverture de la fiche depuis un incident). */
export type SanctionIncident = { id: string; date: string; kindLabel: string };

export function ClientSanctions({
  userId,
  sanctions,
  incident,
}: {
  userId: string;
  sanctions: Sanction[];
  incident?: SanctionIncident;
}) {
  const { t } = useLanguage();
  return (
    <Section title={t("adminClients.sanctions")}>
      {sanctions.length === 0 ? <AppText variant="body">{t("adminClients.noSanctions")}</AppText> : null}
      {sanctions.map((sanction) => (
        <SanctionLine key={sanction.id} sanction={sanction} />
      ))}
      <SanctionForm key={incident?.id ?? "none"} userId={userId} incident={incident} />
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
      {sanction.incident_id ? <AppText variant="caption">{t("adminClients.linkedToIncident")}</AppText> : null}
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

function SanctionForm({ userId, incident }: { userId: string; incident?: SanctionIncident }) {
  const { t } = useLanguage();
  const add = useAddSanction();
  const initialReason = incident
    ? t("adminClients.incidentReason", { date: formatDate(incident.date), kind: incident.kindLabel })
    : "";
  // Aucun niveau présélectionné : l’administratrice choisit explicitement.
  const [level, setLevel] = useState<SanctionLevel | null>(null);
  const [reason, setReason] = useState(initialReason);
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!level) return setError(t("adminClients.levelRequired"));
    if (!reason.trim()) return setError(t("adminClients.reasonRequired"));
    let endsAt: string | null = null;
    if (level === "suspension" && endsOn) {
      const date = brusselsDateTime(endsOn, "23:59");
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
      { user_id: userId, level, reason: reason.trim(), ends_at: endsAt, incident_id: incident?.id ?? null },
      {
        onSuccess: () => {
          setReason("");
          setEndsOn("");
          setLevel(null);
          notify(t("adminClients.sanctionAdded"), "");
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <View style={styles.form}>
      <AppText variant="bodyStrong">{t("adminClients.newSanction")}</AppText>
      {incident ? (
        <AppText variant="body" style={styles.incident}>
          {t("adminClients.incidentLinked", { date: formatDate(incident.date) })}
        </AppText>
      ) : null}
      <View style={styles.chips}>
        {LEVELS.map((item) => (
          <Chip
            key={item.level}
            label={t(item.key)}
            selected={level === item.level}
            onPress={() => setLevel(item.level)}
            style={styles.chip}
          />
        ))}
      </View>
      <TextField label={t("adminClients.reason")} value={reason} onChangeText={setReason} multiline maxLength={1000} />
      {level === "suspension" ? (
        <DateField
          label={t("adminClients.endsOn")}
          hint={t("adminClients.endsOnHint")}
          value={endsOn}
          onChange={setEndsOn}
        />
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button
        label={t("adminClients.addSanction")}
        variant={level === "ban" ? "danger" : "primary"}
        disabled={!level || !reason.trim()}
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
  chip: { flexGrow: 1 },
  incident: { color: colors.ink },
});
