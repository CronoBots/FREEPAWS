import { Stack } from "expo-router";

import type { Service } from "@/api/services";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { useLanguage } from "@/i18n";
import { openContactEmail } from "@/lib/contact";
import { formatPrice } from "@/utils/format";

/** Prestation sans réservation en ligne : description du site + « Prendre rendez-vous » par email. */
export function ServiceInfo({ service }: { service: Service }) {
  const { t } = useLanguage();
  const price = formatPrice(service.displayPriceCents);
  const paragraphs = (service.description || service.summary).split(/\n{2,}/);
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen
        underHeader
        heading={service.name}
        footer={
          <Button
            label={t("coaching.appointment")}
            onPress={() => void openContactEmail(t("coaching.appointmentSubject", { name: service.name }))}
          />
        }
      >
        {paragraphs.map((text) => (
          <AppText key={text} variant="body">
            {text}
          </AppText>
        ))}
        {price ? <AppText variant="bodyStrong">{price}</AppText> : null}
        <Card>
          <AppText variant="body">{t("coaching.ctaText")}</AppText>
        </Card>
      </Screen>
    </>
  );
}
