import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { AppText } from "@/components/text";
import { openContactEmail } from "@/lib/contact";

// Uniquement des faits : ce que l’app collecte réellement et ce que dit freepaws.be.
// La politique de confidentialité complète (identité légale, hébergement, durées de conservation)
// doit être rédigée et validée par FreePaws avant la publication sur les stores.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: "FreePaws",
    body: "Coaching canin et FreePaws Park, Province de Liège. Contact : contact@freepaws.be.",
  },
  {
    title: "Données enregistrées par l’app",
    body: "Votre adresse email (connexion), votre nom et, si vous le renseignez, votre téléphone ; les informations sur vos chiens que vous saisissez ; vos réservations.",
  },
  {
    title: "Caméra du parc",
    body: "Parc libre : le direct permet de découvrir le parc à tout moment. Parc réservé : l’accès devient privé, conformément à la protection de la vie privée.",
  },
  {
    title: "Supprimer vos données",
    body: "Vous pouvez supprimer votre compte et toutes vos données à tout moment depuis l’onglet Compte, ou nous écrire.",
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
      <Button label="Nous écrire" variant="secondary" onPress={() => void openContactEmail()} />
    </Screen>
  );
}
