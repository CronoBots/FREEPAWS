import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  type Vaccination,
  type VaccineType,
  useDeleteVaccination,
  useSaveVaccination,
  useVaccinations,
  useVaccineTypes,
} from "@/api/park-profile";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { DateField } from "@/components/date-field";
import { ChoiceRow, ProofField, todayIso } from "@/components/fiche/form-parts";
import { ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { type Language, useLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { confirm, notify } from "@/lib/confirm";
import { openStoredFile, type PickedFile, uploadFile } from "@/lib/files";
import { colors, space } from "@/theme";
import { formatDate } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

/** Nom du vaccin dans la langue courante (traduction saisie par l’administratrice, sinon le nom). */
export function vaccineLabel(
  vaccine: Pick<VaccineType, "name" | "translations"> | { name: string; translations: unknown } | null,
  language: Language,
  fallback: string,
): string {
  if (!vaccine) return fallback;
  if (language === "fr") return vaccine.name;
  const entry = ((vaccine.translations ?? {}) as Record<string, unknown>)[language];
  if (typeof entry === "string" && entry.trim()) return entry;
  if (entry && typeof entry === "object") {
    const name = (entry as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return vaccine.name;
}

/** Vaccination qui demande l’attention du propriétaire (en attente ou refusée). */
export function vaccinationAttention(rows: Vaccination[] | undefined): "rejected" | "pending" | null {
  if (rows?.some((row) => row.status === "rejected")) return "rejected";
  if (rows?.some((row) => row.status === "pending")) return "pending";
  return null;
}

/**
 * Doses regroupées par vaccin (dans l’ordre des vaccins demandés), la plus récente d’abord :
 * les suivantes sont marquées « dose précédente ».
 */
export function groupVaccinations(rows: Vaccination[], types: Pick<VaccineType, "id">[] | undefined) {
  const order = new Map((types ?? []).map((type, index) => [type.id, index]));
  const rank = (row: Vaccination) => order.get(row.vaccine_type_id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.vaccine_type_id.localeCompare(b.vaccine_type_id) ||
      b.vaccinated_on.localeCompare(a.vaccinated_on) ||
      b.created_at.localeCompare(a.created_at),
  );
  return sorted.map((row, index) => ({
    row,
    previous: index > 0 && sorted[index - 1]?.vaccine_type_id === row.vaccine_type_id,
  }));
}

export function VaccinationsSection({ dogId }: { dogId: string }) {
  const { t } = useLanguage();
  const types = useVaccineTypes();
  const vaccinations = useVaccinations(dogId);
  const [editing, setEditing] = useState<Vaccination | null>(null);
  const [formKey, setFormKey] = useState(0);

  const resetForm = () => {
    setEditing(null);
    setFormKey((key) => key + 1);
  };

  const loading = types.isLoading || vaccinations.isLoading;
  const error = types.error ?? vaccinations.error;

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {t("fiche.vaccinations")}
      </AppText>
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView
          error={error}
          onRetry={() => {
            void types.refetch();
            void vaccinations.refetch();
          }}
        />
      ) : (
        <>
          <AppText variant="caption">{t("fiche.vaccinationsIntro")}</AppText>
          {vaccinations.data?.length ? (
            groupVaccinations(vaccinations.data, types.data ?? undefined).map(({ row, previous }) => (
              <VaccinationCard
                key={row.id}
                row={row}
                previous={previous}
                editing={editing?.id === row.id}
                onEdit={() => {
                  setEditing(row);
                  setFormKey((key) => key + 1);
                }}
                onDeleted={() => {
                  if (editing?.id === row.id) resetForm();
                }}
              />
            ))
          ) : (
            <AppText variant="body">{t("fiche.noVaccinations")}</AppText>
          )}
          {types.data?.length ? (
            <VaccinationForm key={formKey} dogId={dogId} types={types.data} editing={editing} onDone={resetForm} />
          ) : (
            <Card>
              <AppText variant="body">{t("fiche.noVaccineTypes")}</AppText>
            </Card>
          )}
        </>
      )}
    </View>
  );
}

function StatusBadge({ row }: { row: Vaccination }) {
  const { t } = useLanguage();
  if (row.status === "pending") return <Badge tone="warning" label={t("fiche.statusPending")} />;
  if (row.status === "rejected") return <Badge tone="danger" label={t("fiche.statusRejected")} />;
  const date = formatDate(row.valid_until);
  if (row.valid_until < todayIso()) return <Badge tone="neutral" label={t("fiche.statusExpired", { date })} />;
  return <Badge tone="success" label={t("fiche.statusValidated", { date })} />;
}

function VaccinationCard({
  row,
  previous,
  editing,
  onEdit,
  onDeleted,
}: {
  row: Vaccination;
  previous: boolean;
  editing: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { t, language } = useLanguage();
  const remove = useDeleteVaccination();
  const [opening, setOpening] = useState(false);
  const name = vaccineLabel(row.vaccine, language, t("fiche.vaccineFallback"));

  const openProof = async () => {
    if (!row.proof_path) return;
    setOpening(true);
    try {
      await openStoredFile("proofs", row.proof_path);
    } catch (error) {
      notify(t("fiche.openFailed"), toUserMessage(error));
    } finally {
      setOpening(false);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: t("fiche.removeTitle"),
      message: t("fiche.removeMessage", { vaccine: name, date: formatDate(row.vaccinated_on) }),
      confirmLabel: t("fiche.removeConfirm"),
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(row.id, {
      onSuccess: onDeleted,
      onError: (error) => notify(t("fiche.removeFailed"), toUserMessage(error)),
    });
  };

  return (
    <Card>
      <AppText variant="bodyStrong">{name}</AppText>
      {previous ? <AppText variant="caption">{t("fiche.previousDose")}</AppText> : null}
      <StatusBadge row={row} />
      <AppText variant="caption">
        {/* Validée : la fin de validité est déjà dans le badge. */}
        {row.status === "validated"
          ? t("fiche.vaccinatedOnly", { date: formatDate(row.vaccinated_on) })
          : t("fiche.vaccinatedOnLine", { date: formatDate(row.vaccinated_on), until: formatDate(row.valid_until) })}
      </AppText>
      {row.status === "rejected" && row.review_note ? (
        <AppText variant="body">{t("fiche.reviewNote", { note: row.review_note })}</AppText>
      ) : null}
      <View style={styles.rowActions}>
        {row.proof_path ? (
          <Button
            variant="ghost"
            label={t("fiche.proofView")}
            loading={opening}
            onPress={() => void openProof()}
            style={styles.rowAction}
          />
        ) : null}
        <Button variant="ghost" label={t("fiche.edit")} disabled={editing} onPress={onEdit} style={styles.rowAction} />
        <Button
          variant="dangerText"
          label={t("fiche.remove")}
          loading={remove.isPending}
          onPress={() => void onDelete()}
          style={styles.rowAction}
        />
      </View>
    </Card>
  );
}

type FormErrors = { vaccine?: string; vaccinatedOn?: string; validUntil?: string };

function VaccinationForm({
  dogId,
  types,
  editing,
  onDone,
}: {
  dogId: string;
  types: VaccineType[];
  editing: Vaccination | null;
  onDone: () => void;
}) {
  const { t, language } = useLanguage();
  const { userId } = useAuth();
  const save = useSaveVaccination();
  const [vaccineId, setVaccineId] = useState<string | null>(editing?.vaccine_type_id ?? null);
  const [vaccinatedOn, setVaccinatedOn] = useState(editing?.vaccinated_on ?? "");
  const [validUntil, setValidUntil] = useState(editing?.valid_until ?? "");
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const onSave = async () => {
    const next: FormErrors = {};
    if (!vaccineId) next.vaccine = t("fiche.vaccineRequired");
    // DateField renvoie "" tant que la date est vide, incomplète ou inexistante.
    const dateOk = Boolean(vaccinatedOn) && vaccinatedOn <= todayIso();
    if (!dateOk) next.vaccinatedOn = t("fiche.vaccinatedOnError");
    if (!validUntil || (dateOk && validUntil <= vaccinatedOn)) {
      next.validUntil = t("fiche.validUntilError");
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !vaccineId) return;

    let proofPath = editing?.proof_path ?? null;
    if (proof && userId) {
      setUploading(true);
      try {
        proofPath = await uploadFile("proofs", userId, proof);
      } catch (error) {
        setUploading(false);
        notify(t("profile.saveFailed"), toUserMessage(error));
        return;
      }
      setUploading(false);
    }

    save.mutate(
      {
        id: editing?.id,
        dog_id: dogId,
        vaccine_type_id: vaccineId,
        vaccinated_on: vaccinatedOn,
        valid_until: validUntil,
        proof_path: proofPath,
      },
      {
        onSuccess: () => {
          notify(t("fiche.saved"), t("fiche.savedText"));
          onDone();
        },
        onError: (error) => notify(t("profile.saveFailed"), toUserMessage(error)),
      },
    );
  };

  return (
    <Card style={styles.form}>
      <AppText variant="heading" accessibilityRole="header">
        {editing ? t("fiche.editVaccination") : t("fiche.addVaccination")}
      </AppText>
      <ChoiceRow
        label={t("fiche.vaccine")}
        value={vaccineId}
        onChange={setVaccineId}
        options={types.map((type) => ({
          value: type.id,
          label: vaccineLabel(type, language, t("fiche.vaccineFallback")),
        }))}
      />
      {errors.vaccine ? (
        <AppText variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {errors.vaccine}
        </AppText>
      ) : null}
      <DateField
        label={t("fiche.vaccinatedOn")}
        value={vaccinatedOn}
        onChange={setVaccinatedOn}
        error={errors.vaccinatedOn}
      />
      <DateField label={t("fiche.validUntil")} value={validUntil} onChange={setValidUntil} error={errors.validUntil} />
      <ProofField
        label={t("fiche.vaccinationProof")}
        storedPath={editing?.proof_path ?? null}
        picked={proof}
        onPick={setProof}
      />
      <Button label={t("fiche.saveVaccination")} loading={uploading || save.isPending} onPress={() => void onSave()} />
      {editing ? <Button variant="ghost" label={t("fiche.cancelEdit")} onPress={onDone} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  form: { gap: space.md },
  // Actions groupées à gauche, à leur largeur naturelle (pas étirées sur toute la carte).
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  rowAction: { paddingHorizontal: space.sm, minWidth: 44 },
  error: { color: colors.danger },
});
