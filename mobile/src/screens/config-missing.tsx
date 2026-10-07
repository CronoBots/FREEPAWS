import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";

/** Affiché en développement si les variables Supabase ne sont pas renseignées. */
export function ConfigMissing() {
  const { t } = useLanguage();
  return (
    <Screen title={t("config.title")}>
      <AppText variant="body">{t("config.text")}</AppText>
    </Screen>
  );
}
