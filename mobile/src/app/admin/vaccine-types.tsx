import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useAllVaccineTypes, useSaveVaccineType } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { ErrorText } from "@/components/admin/clients/shared";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { confirm, notify } from "@/lib/confirm";
import type { Json } from "@/types/database";
import { colors, space } from "@/theme";
import { toUserMessage } from "@/utils/errors";

type VaccineType = NonNullable<ReturnType<typeof useAllVaccineTypes>["data"]>[number];

function englishName(item: VaccineType) {
  return (item.translations as { en?: { name?: string } } | null)?.en?.name?.trim() || null;
}

export default function AdminVaccineTypesRoute() {
  return (
    <AdminGuard>
      <VaccineTypes />
    </AdminGuard>
  );
}

function VaccineTypes() {
  const { t } = useLanguage();
  const types = useAllVaccineTypes();
  const save = useSaveVaccineType();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError(t("adminClients.nameRequired"));
    const nextOrder = Math.max(0, ...(types.data ?? []).map((item) => item.sort_order)) + 1;
    const translations: Json = nameEn.trim() ? { en: { name: nameEn.trim() } } : {};
    save.mutate(
      { name: name.trim(), translations, required, active: true, sort_order: nextOrder },
      {
        onSuccess: () => {
          setName("");
          setNameEn("");
          setRequired(true);
        },
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Screen underHeader refreshing={types.isRefetching} onRefresh={() => void types.refetch()}>
      <Card>
        <AppText variant="heading">{t("adminClients.newType")}</AppText>
        <AppText variant="caption">{t("adminClients.typeIntro")}</AppText>
        <TextField label={t("adminClients.nameFr")} value={name} onChangeText={setName} maxLength={80} />
        <TextField
          label={t("adminClients.nameEn")}
          hint={t("adminClients.nameEnHint")}
          value={nameEn}
          onChangeText={setNameEn}
          maxLength={80}
        />
        <Checkbox label={t("adminClients.requiredForPark")} checked={required} onChange={setRequired} />
        <ErrorText>{error}</ErrorText>
        <Button
          label={t("adminClients.add")}
          disabled={!name.trim()}
          loading={save.isPending && !save.variables?.id}
          onPress={submit}
        />
      </Card>

      {types.isLoading ? (
        <LoadingView />
      ) : types.isError ? (
        <ErrorView error={types.error} onRetry={() => void types.refetch()} />
      ) : !types.data?.length ? (
        <EmptyView title={t("adminClients.noTypes")} message={t("adminClients.noTypesText")} />
      ) : (
        <>
          {/* Titre qui sépare le formulaire d’ajout des vaccins déjà enregistrés. */}
          <AppText variant="heading" accessibilityRole="header" style={styles.listTitle}>
            {t("adminClients.typesTitle")}
          </AppText>
          {types.data.map((item) => (
            <VaccineTypeCard key={item.id} item={item} />
          ))}
        </>
      )}
    </Screen>
  );
}

function VaccineTypeCard({ item }: { item: VaccineType }) {
  const { t } = useLanguage();
  const save = useSaveVaccineType();
  const [saved, setSaved] = useState(false);
  const english = englishName(item);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  // Ces cases changent aussitôt les conditions de réservation de tous les clients :
  // on confirme avant de retirer une exigence ou de désactiver un vaccin.
  const toggle = async (values: { required?: boolean; active?: boolean }) => {
    setSaved(false);
    const loosening = values.required === false || values.active === false;
    if (loosening) {
      const deactivate = values.active === false;
      const ok = await confirm({
        title: t(deactivate ? "adminClients.deactivateTitle" : "adminClients.unrequireTitle"),
        message: t(deactivate ? "adminClients.deactivateMessage" : "adminClients.unrequireMessage"),
        confirmLabel: t(deactivate ? "adminClients.deactivateConfirm" : "adminClients.unrequireConfirm"),
        destructive: true,
      });
      if (!ok) return;
    }
    save.mutate(
      { id: item.id, ...values },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => notify(t("adminClients.saveFailed"), toUserMessage(err)),
      },
    );
  };

  return (
    <Card style={!item.active && styles.inactive}>
      <AppText variant="heading">{item.name}</AppText>
      {/* Toujours une ligne « EN : » : toutes les cartes ont la même structure. */}
      <AppText variant="caption">
        {t("adminClients.englishName", { name: english ?? t("adminClients.englishSame") })}
      </AppText>
      {/* La zone tactile des cases (44 px) laisse un vide sous la dernière : on le compense. */}
      <View style={!saved && styles.checks}>
        <Checkbox
          label={t("adminClients.requiredForPark")}
          checked={item.required}
          onChange={(value) => void toggle({ required: value })}
        />
        <Checkbox
          label={t("adminClients.typeActive")}
          checked={item.active}
          onChange={(value) => void toggle({ active: value })}
        />
      </View>
      {saved ? (
        <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
          {t("adminClients.typeSaved")}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  inactive: { borderColor: colors.line, opacity: 0.8 },
  listTitle: { marginTop: space.sm },
  checks: { marginBottom: -space.sm },
});
