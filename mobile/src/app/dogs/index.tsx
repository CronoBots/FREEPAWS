import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { type Dog, useDogs } from "@/api/dogs";
import { type Vaccination, type VaccineType, useVaccinations, useVaccineTypes } from "@/api/park-profile";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { todayIso } from "@/components/fiche/form-parts";
import { vaccinationAttention } from "@/components/fiche/vaccinations-section";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { colors, space } from "@/theme";

export default function DogsRoute() {
  const { t } = useLanguage();
  const dogs = useDogs();
  const add = () => router.push({ pathname: "/dogs/[id]", params: { id: "new" } });

  return (
    <Screen underHeader refreshing={dogs.isRefetching} onRefresh={() => void dogs.refetch()}>
      {dogs.isLoading ? (
        <LoadingView />
      ) : dogs.isError ? (
        <ErrorView error={dogs.error} onRetry={() => void dogs.refetch()} />
      ) : dogs.data?.length === 0 ? (
        <EmptyView
          title={t("dogs.emptyTitle")}
          message={t("dogs.emptyText")}
          actionLabel={t("dogs.add")}
          onAction={add}
        />
      ) : (
        <>
          {dogs.data?.map((dog) => (
            <DogRow key={dog.id} dog={dog} />
          ))}
          <Button label={t("dogs.add")} variant="secondary" onPress={add} />
        </>
      )}
    </Screen>
  );
}

type VaccinationStatus = "rejected" | "pending" | "upToDate" | "toComplete";

/** État des vaccinations d’un chien, comme sur la fiche : refusée, en attente, validées ou à compléter. */
function vaccinationStatus(
  rows: Vaccination[] | undefined,
  types: VaccineType[] | undefined,
): VaccinationStatus | null {
  if (!rows || !types) return null;
  const attention = vaccinationAttention(rows);
  if (attention) return attention;
  const required = types.filter((type) => type.required);
  if (required.length === 0) return null;
  const today = todayIso();
  const covered = required.every((type) =>
    rows.some((row) => row.vaccine_type_id === type.id && row.status === "validated" && row.valid_until >= today),
  );
  return covered ? "upToDate" : "toComplete";
}

const STATUS_BADGES = {
  rejected: { tone: "danger", key: "fiche.dogRejected" },
  pending: { tone: "warning", key: "fiche.dogPending" },
  upToDate: { tone: "success", key: "fiche.dogUpToDate" },
  toComplete: { tone: "neutral", key: "fiche.dogToComplete" },
} as const;

/** Ligne d’un chien : nom, race et badge de l’état de ses vaccinations. */
function DogRow({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const types = useVaccineTypes();
  const vaccinations = useVaccinations(dog.id);
  const status = vaccinationStatus(vaccinations.data, types.data ?? undefined);
  const badge = status ? STATUS_BADGES[status] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[dog.name, dog.breed, badge ? t(badge.key) : null].filter(Boolean).join(", ")}
      onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: dog.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{dog.name}</AppText>
        {dog.breed ? <AppText variant="caption">{dog.breed}</AppText> : null}
        {badge ? <Badge tone={badge.tone} label={t(badge.key)} /> : null}
      </View>
      <AppText style={styles.chevron}>›</AppText>
    </Pressable>
  );
}

// Même apparence que ListRow, avec un badge sous la race.
const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  texts: { flex: 1, gap: space.xs },
  chevron: { fontSize: 24, color: colors.inkSoft, paddingLeft: space.md },
});
