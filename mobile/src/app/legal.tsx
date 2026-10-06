import { Linking } from "react-native";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { env } from "@/lib/env";

// Projet de politique de confidentialité : à faire valider (identité légale, n° BCE, hébergeurs)
// avant publication. La version de référence doit aussi être publiée sur freepaws.be (exigé par les stores).
const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Qui sommes-nous",
    body: "FreePaws (coaching canin et FreePaws Park), province de Liège, Belgique. Contact : contact@freepaws.be.",
  },
  {
    title: "Données collectées",
    body: "Votre email (connexion), votre nom et, si vous le souhaitez, votre téléphone ; les informations sur vos chiens que vous saisissez ; vos réservations. Aucune donnée n'est revendue ni utilisée à des fins publicitaires.",
  },
  {
    title: "Pourquoi",
    body: "Gérer vos réservations, vous contacter en cas d'imprévu, et assurer la sécurité du parc. Base légale : exécution du service que vous demandez (RGPD art. 6.1.b).",
  },
  {
    title: "Caméras du parc",
    body: "Lorsque le parc est libre, le direct est public et montre le terrain vide. Pendant une session réservée, le direct est privé : seule la personne ayant réservé et FreePaws (en cas d'incident) peuvent le voir. Les images ne sont pas enregistrées par l'application.",
  },
  {
    title: "Hébergement et durée",
    body: "Les données sont hébergées dans l'Union européenne (Supabase, région Irlande). Elles sont conservées tant que votre compte existe ; l'historique de facturation éventuel est conservé selon les obligations légales belges.",
  },
  {
    title: "Vos droits",
    body: "Accès, rectification, effacement, portabilité, opposition. Vous pouvez supprimer votre compte à tout moment depuis l'onglet Compte, ou nous écrire. Vous pouvez aussi saisir l'Autorité de protection des données (autoriteprotectiondonnees.be).",
  },
];

export default function LegalRoute() {
  return (
    <Screen underHeader>
      {SECTIONS.map((section) => (
        <AppText key={section.title} variant="body">
          <AppText variant="bodyStrong">{section.title}. </AppText>
          {section.body}
        </AppText>
      ))}
      <Button
        label="Nous écrire"
        variant="secondary"
        onPress={() => void Linking.openURL(`mailto:${env.contactEmail}`)}
      />
    </Screen>
  );
}
