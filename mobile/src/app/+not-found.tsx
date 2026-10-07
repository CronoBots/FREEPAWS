import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { space } from "@/theme";

// L’en-tête dit « Page introuvable » : le corps explique et propose une sortie.
export default function NotFoundRoute() {
  const { t } = useLanguage();
  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: t("titles.notFound") }} />
      <View style={styles.box}>
        <AppText variant="title" accessibilityRole="header">
          {t("notFound.title")}
        </AppText>
        <AppText variant="body">{t("notFound.text")}</AppText>
        <Button label={t("notFound.home")} onPress={() => router.replace("/")} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { paddingTop: space.xxl, gap: space.md },
  button: { marginTop: space.md },
});
