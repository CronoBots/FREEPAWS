import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { type TranslationKey, useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";
import { space } from "@/theme";

// Uniquement des faits : ce que l’app collecte réellement et ce que dit freepaws.be.
// La politique de confidentialité complète (identité légale, hébergement, durées de conservation)
// doit être rédigée et validée par FreePaws avant la publication sur les stores ; ajouter alors
// une ligne « Mis à jour le … ».
const SECTIONS: { title: TranslationKey; body: TranslationKey; items?: TranslationKey[] }[] = [
  { title: "legal.section1Title", body: "legal.section1" },
  {
    title: "legal.section2Title",
    body: "legal.section2",
    // Liste tenue à jour d’après les colonnes des tables (supabase/migrations).
    items: [
      "legal.dataAccount",
      "legal.dataProfile",
      "legal.dataDogs",
      "legal.dataBookings",
      "legal.dataGuests",
      "legal.dataOther",
    ],
  },
  { title: "legal.section3Title", body: "legal.section3" },
  { title: "legal.section4Title", body: "legal.section4" },
];

export default function LegalRoute() {
  const { t } = useLanguage();
  return (
    <Screen underHeader>
      {SECTIONS.map(({ title, body, items }) => (
        <View key={title} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {t(title)}
          </AppText>
          <AppText variant="body">{t(body)}</AppText>
          {items?.map((item) => (
            <View key={item} style={styles.item}>
              <AppText variant="body" accessibilityElementsHidden importantForAccessibility="no">
                •
              </AppText>
              <AppText variant="body" style={styles.itemText}>
                {t(item)}
              </AppText>
            </View>
          ))}
        </View>
      ))}
      <Button label={t("legal.write")} variant="secondary" onPress={() => void openContactEmail()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  item: { flexDirection: "row", gap: space.sm },
  itemText: { flex: 1 },
});
