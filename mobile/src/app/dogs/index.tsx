import { router } from "expo-router";

import { type Dog, useDogs } from "@/api/dogs";
import { useVaccinations } from "@/api/park-profile";
import { Button } from "@/components/button";
import { vaccinationAttention } from "@/components/fiche/vaccinations-section";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";
import { useLanguage } from "@/i18n";

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

/** Ligne d’un chien, avec un rappel discret si une vaccination est en attente ou refusée. */
function DogRow({ dog }: { dog: Dog }) {
  const { t } = useLanguage();
  const vaccinations = useVaccinations(dog.id);
  const attention = vaccinationAttention(vaccinations.data);
  const status =
    attention === "rejected" ? t("fiche.dogRejected") : attention === "pending" ? t("fiche.dogPending") : null;
  const detail = [dog.breed, status].filter(Boolean).join(" · ");
  return (
    <ListRow
      label={dog.name}
      detail={detail || undefined}
      onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: dog.id } })}
    />
  );
}
