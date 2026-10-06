import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";

/** Affiché en développement si les variables Supabase ne sont pas renseignées. */
export function ConfigMissing() {
  return (
    <Screen title="Configuration requise">
      <AppText variant="body">
        Les variables EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_KEY ne sont pas définies. Copiez
        mobile/.env.example en mobile/.env.local, renseignez les valeurs du projet Supabase, puis relancez l’app.
      </AppText>
    </Screen>
  );
}
