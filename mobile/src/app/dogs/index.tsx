import { router } from "expo-router";

import { useDogs } from "@/api/dogs";
import { Button } from "@/components/button";
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
            <ListRow
              key={dog.id}
              label={dog.name}
              detail={dog.breed ?? undefined}
              onPress={() => router.push({ pathname: "/dogs/[id]", params: { id: dog.id } })}
            />
          ))}
          <Button label={t("dogs.add")} variant="secondary" onPress={add} />
        </>
      )}
    </Screen>
  );
}
