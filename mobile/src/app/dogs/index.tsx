import { router } from "expo-router";

import { useDogs } from "@/api/dogs";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { EmptyView, ErrorView, LoadingView } from "@/components/state-views";

export default function DogsRoute() {
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
          title="Aucun chien enregistré"
          message="Présentez-nous votre compagnon : nous préparerons mieux chaque session."
          actionLabel="Ajouter un chien"
          onAction={add}
        />
      ) : (
        <>
          {dogs.data?.map((dog) => (
            <ListRow
              key={dog.id}
              label={dog.name}
              detail={dog.breed ?? undefined}
              onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: dog.id } })}
            />
          ))}
          <Button label="Ajouter un chien" variant="secondary" onPress={add} />
        </>
      )}
    </Screen>
  );
}
