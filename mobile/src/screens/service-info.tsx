import { Stack } from "expo-router";

import type { Service } from "@/api/services";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { openContactEmail } from "@/lib/contact";
import { formatPrice } from "@/utils/format";

/** Prestation sans réservation en ligne : description du site + « Prendre rendez-vous » par email. */
export function ServiceInfo({ service }: { service: Service }) {
  const price = formatPrice(service.price_cents);
  const paragraphs = (service.description || service.summary).split(/\n{2,}/);
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen
        underHeader
        heading={service.name}
        footer={
          <Button label="Prendre rendez-vous" onPress={() => void openContactEmail(`Rendez-vous : ${service.name}`)} />
        }
      >
        {paragraphs.map((text) => (
          <AppText key={text} variant="body">
            {text}
          </AppText>
        ))}
        {price ? <AppText variant="bodyStrong">{price}</AppText> : null}
        <AppText variant="caption">
          Chaque situation est différente — le plus simple est d’en discuter directement pour voir quel accompagnement
          correspond à votre famille.
        </AppText>
      </Screen>
    </>
  );
}
