import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { AuditEntry } from "@/api/admin-park";
import { dayDate, Section } from "@/components/admin/clients/shared";
import { Button } from "@/components/button";
import { AppText } from "@/components/text";
import { type TranslationKey, useLanguage } from "@/i18n";
import { colors, space } from "@/theme";
import { formatDate, formatDateTime } from "@/utils/dates";

const PAGE = 15;
const MAX_LENGTH = 60;
/** Jour au format AAAA-MM-JJ (date de naissance, validités) : affiché comme une date. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Colonnes techniques jamais affichées. */
const HIDDEN = new Set(["id", "owner_id", "user_id", "created_by", "updated_at", "created_at"]);

const FIELDS: Record<string, TranslationKey> = {
  full_name: "adminClients.csvName",
  name: "adminClients.csvName",
  email: "adminClients.csvEmail",
  phone: "adminClients.csvPhone",
  role: "adminClients.csvRole",
  birth_date: "adminClients.csvBirthDate",
  emergency_contact_name: "adminClients.csvEmergencyName",
  emergency_contact_phone: "adminClients.csvEmergencyPhone",
  insurance_company: "adminClients.insuranceCompany",
  insurance_policy: "adminClients.insurancePolicy",
  insurance_valid_until: "adminClients.insuranceValidUntil",
  insurance_proof_path: "adminClients.fieldInsuranceProof",
  language: "adminClients.fieldLanguage",
  breed: "adminClients.breed",
  sex: "adminClients.sex",
  size: "adminClients.size",
  chip_number: "adminClients.chip",
  dogid_registered: "adminClients.dogid",
  sterilised: "adminClients.sterilised",
  in_heat: "adminClients.inHeat",
  currently_ill: "fiche.currentlyIll",
  antiparasitic_until: "adminClients.antiparasiticUntil",
  vet_name: "adminClients.vet",
  vet_phone: "adminClients.fieldVetPhone",
  notes: "adminClients.notes",
  bite_history: "adminClients.biteHistory",
  reactivity: "adminClients.reactivity",
  special_needs: "adminClients.specialNeeds",
  protocol: "adminClients.protocol",
  protocol_note: "adminClients.protocolNote",
};

const VALUES: Record<string, Record<string, TranslationKey>> = {
  sex: { male: "adminClients.male", female: "adminClients.female" },
  size: {
    small: "adminClients.sizeSmall",
    medium: "adminClients.sizeMedium",
    large: "adminClients.sizeLarge",
    giant: "adminClients.sizeGiant",
  },
  role: { client: "adminClients.roleClient", admin: "adminClients.roleAdmin" },
  language: { fr: "adminClients.languageFr", en: "adminClients.languageEn" },
};

type Change = { old?: unknown; new?: unknown };

function truncate(text: string) {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}

export function ClientHistory({ history, dogNames }: { history: AuditEntry[]; dogNames: Map<string, string> }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(PAGE);

  const show = (field: string, value: unknown): string => {
    if (value == null || value === "") return t("adminClients.empty");
    if (typeof value === "boolean") return value ? t("adminClients.yes") : t("adminClients.no");
    if (typeof value === "string") {
      const mapped = VALUES[field]?.[value];
      if (mapped) return truncate(t(mapped));
      return truncate(ISO_DAY.test(value) ? formatDate(dayDate(value)) : value);
    }
    if (typeof value === "number") return String(value);
    if (Array.isArray(value))
      return truncate(value.map((item) => show(field, item)).join(", ")) || t("adminClients.empty");
    if (typeof value === "object") {
      return truncate(
        Object.entries(value as Record<string, unknown>)
          .map(([key, item]) => `${key}${t("adminClients.colon")}${show(key, item)}`)
          .join(" · "),
      );
    }
    return truncate(String(value));
  };

  // Champ sans libellé connu : intitulé générique plutôt que le nom technique de la colonne.
  const label = (field: string) => t(FIELDS[field] ?? "adminClients.fieldOther");

  return (
    <Section title={t("adminClients.history")}>
      {history.length === 0 ? <AppText variant="body">{t("adminClients.noHistory")}</AppText> : null}
      {history.slice(0, count).map((entry) => {
        const action =
          entry.action === "INSERT"
            ? t("adminClients.actionInsert")
            : entry.action === "DELETE"
              ? t("adminClients.actionDelete")
              : t("adminClients.actionUpdate");
        const by = entry.actor_is_admin
          ? t("adminClients.byAdmin")
          : entry.actor
            ? t("adminClients.byClient")
            : t("adminClients.bySystem");
        const table =
          entry.table_name === "profiles"
            ? t("adminClients.tableProfiles")
            : entry.table_name === "dogs"
              ? [t("adminClients.tableDogs"), entry.row_id ? dogNames.get(entry.row_id) : null]
                  .filter(Boolean)
                  .join(" · ")
              : t("adminClients.tableOther");
        const changes = Object.entries((entry.changes ?? {}) as Record<string, Change>).filter(
          ([field, change]) =>
            !HIDDEN.has(field) && (entry.action !== "INSERT" || (change?.new != null && change.new !== "")),
        );
        return (
          <View key={entry.id} style={styles.entry}>
            <AppText variant="bodyStrong">{`${table} · ${action}`}</AppText>
            <AppText variant="caption">{`${formatDateTime(entry.created_at)} · ${by}`}</AppText>
            {entry.action !== "DELETE"
              ? changes.map(([field, change]) => (
                  <AppText key={field} variant="caption" style={styles.change}>
                    <AppText variant="caption" style={styles.field}>
                      {label(field)}
                    </AppText>
                    {entry.action === "INSERT"
                      ? `${t("adminClients.colon")}${show(field, change?.new)}`
                      : `${t("adminClients.colon")}${show(field, change?.old)} → ${show(field, change?.new)}`}
                  </AppText>
                ))
              : null}
          </View>
        );
      })}
      {history.length > count ? (
        <Button label={t("adminClients.showMore")} variant="ghost" onPress={() => setCount((value) => value + PAGE)} />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  entry: {
    gap: 2,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  change: { color: colors.ink },
  field: { fontWeight: "600", color: colors.ink },
});
