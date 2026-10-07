import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";

// Uniquement des faits : ce que l’app collecte réellement et ce que dit freepaws.be.
// La politique de confidentialité complète (identité légale, hébergement, durées de conservation)
// doit être rédigée et validée par FreePaws avant la publication sur les stores.
const SECTIONS = [
  ["legal.section1Title", "legal.section1"],
  ["legal.section2Title", "legal.section2"],
  ["legal.section3Title", "legal.section3"],
  ["legal.section4Title", "legal.section4"],
] as const;

export default function LegalRoute() {
  const { t } = useLanguage();
  return (
    <Screen underHeader>
      {SECTIONS.map(([title, body]) => (
        <AppText key={title} variant="body">
          <AppText variant="bodyStrong">{t(title)}. </AppText>
          {t(body)}
        </AppText>
      ))}
      <Button label={t("legal.write")} variant="secondary" onPress={() => void openContactEmail()} />
    </Screen>
  );
}
