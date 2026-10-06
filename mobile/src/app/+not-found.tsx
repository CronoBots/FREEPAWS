import { router, Stack } from "expo-router";

import { Screen } from "@/components/screen";
import { EmptyView } from "@/components/state-views";

export default function NotFoundRoute() {
  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: "Page introuvable" }} />
      <EmptyView
        title="Cette page n'existe pas"
        actionLabel="Retour à l'accueil"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
