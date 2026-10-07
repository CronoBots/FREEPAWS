import { useState } from "react";
import { StyleSheet } from "react-native";

import { useAllVaccineTypes, useSaveVaccineType } from "@/api/admin-park";
import { AdminGuard } from "@/components/admin-guard";
import { BadgeRow, ErrorText } from "@/components/admin/clients/shared";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Checkbox } from "@/components/checkbox";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useLanguage } from "@/i18n";
import { notify } from "@/lib/confirm";
import type { Json } from "@/types/database";
import { colors } from "@/theme";
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

  const toggle = (item: VaccineType, values: { required?: boolean; active?: boolean }) =>
    save.mutate(
      { id: item.id, ...values },
      { onError: (err) => notify(t("adminClients.saveFailed"), toUserMessage(err)) },
    );

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
        <Button label={t("adminClients.add")} loading={save.isPending && !save.variables?.id} onPress={submit} />
      </Card>

      {types.isLoading ? (
        <LoadingView />
      ) : types.isError ? (
        <ErrorView error={types.error} onRetry={() => void types.refetch()} />
      ) : !types.data?.length ? (
        <EmptyView title={t("adminClients.noTypes")} message={t("adminClients.noTypesText")} />
      ) : (
        types.data.map((item) => (
          <Card key={item.id} style={!item.active && styles.inactive}>
            <AppText variant="heading">{item.name}</AppText>
            {englishName(item) ? <AppText variant="caption">{englishName(item)}</AppText> : null}
            <BadgeRow>
              <Badge
                label={item.required ? t("adminClients.typeRequired") : t("adminClients.typeOptional")}
                tone={item.required ? "warning" : "neutral"}
              />
              <Badge
                label={item.active ? t("adminClients.typeActive") : t("adminClients.typeInactive")}
                tone={item.active ? "success" : "neutral"}
              />
            </BadgeRow>
            <Checkbox
              label={t("adminClients.requiredForPark")}
              checked={item.required}
              onChange={(value) => toggle(item, { required: value })}
            />
            <Checkbox
              label={t("adminClients.typeActive")}
              checked={item.active}
              onChange={(value) => toggle(item, { active: value })}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inactive: { borderColor: colors.line, opacity: 0.8 },
});
