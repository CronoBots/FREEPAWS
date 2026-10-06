# Publication sur l'App Store et Google Play

L'app est prête techniquement pour les stores (identifiant `be.freepaws.app`, icônes, splash,
suppression de compte, politique de confidentialité, compte de démonstration). Les builds et
l'envoi se font dans le cloud avec **EAS** (Expo Application Services) : pas besoin de Mac.

## 1. Comptes à créer (par FreePaws)

| Compte | Coût | Remarques |
|---|---|---|
| Apple Developer Program | 99 USD / an | **Organisation** recommandée (nom « FreePaws » affiché comme vendeur) : nécessite un numéro D-U-N-S (gratuit, quelques jours). En individuel, c'est le nom de la personne qui s'affiche. |
| Google Play Console | 25 USD une fois | Un compte **personnel** récent doit faire un test fermé avec au moins 12 testeurs pendant 14 jours avant la mise en production ; un compte **organisation** (D-U-N-S) en est dispensé. À vérifier au moment de l'inscription. |
| Expo (EAS) | Gratuit pour démarrer | Builds cloud ; offre payante seulement si besoin de plus de builds. |
| Supabase | Gratuit pour démarrer | Projet en région UE (Francfort ou Irlande). Offre Pro (~25 USD/mois) conseillée en production : sauvegardes quotidiennes, pas de mise en pause. |

## 2. Mise en place (une seule fois)

```bash
# Backend
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push                     # applique les migrations
psql "<connexion>" -f supabase/seed.sql  # catalogue de départ (après validation des horaires)
npx supabase functions deploy live-stream

# Dans le dashboard Supabase :
#  - Authentication → Email : activer « Confirm email », OTP 6 chiffres, expiration 600 s
#  - Authentication → Email Templates : coller supabase/templates/otp.html (Magic Link + Confirm signup)
#  - Authentication → SMTP : brancher un vrai expéditeur (ex. Brevo, Resend) sur @freepaws.be
#  - Créer le compte de démonstration (email + mot de passe ≥ 12 caractères) pour les reviewers
#  - Donner le rôle admin : update profiles set role = 'admin' where email = 'contact@freepaws.be';

# App
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                  # crée le projet EAS et renseigne l'ID
# Renseigner dans eas.json (profil "base") :
#   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY (clé publishable), EXPO_PUBLIC_REVIEW_EMAIL
```

## 3. Builds et envoi

```bash
cd mobile
npx eas-cli@latest build --profile preview --platform android   # APK à installer pour tester
npx eas-cli@latest build --profile production --platform all     # builds de production
npx eas-cli@latest submit --platform ios                         # → TestFlight / App Store Connect
npx eas-cli@latest submit --platform android                     # → Play Console (piste interne)
```

Les numéros de build sont incrémentés automatiquement (`appVersionSource: remote`).
Les corrections de JavaScript/écrans peuvent ensuite être publiées sans repasser par les stores
avec `eas update` (pas pour les changements natifs).

## 4. Fiche store — checklist

- [ ] Nom : **FreePaws** · sous-titre (30 car.) ex. « Parc canin & coaching »
- [ ] Description courte et longue (FR), mots-clés
- [ ] Icône 1024×1024 — **à régénérer depuis un logo HD** (le logo actuel fait 506 px)
- [ ] Captures d'écran : iPhone 6,9" (1320×2868) et Android téléphone, 3 à 8 par plateforme
- [ ] URL de la **politique de confidentialité** publiée sur freepaws.be (obligatoire)
- [ ] URL de support (ex. freepaws.be/contact ou mailto)
- [ ] Catégorie : Style de vie (ou Santé et forme)
- [ ] Classification d'âge : questionnaire (pas de contenu sensible → 4+ / Tout public)
- [ ] Apple « App Privacy » / Google « Sécurité des données » : email, nom, téléphone (facultatif),
      contenus saisis (chiens), aucune publicité, aucun suivi, données supprimables dans l'app
- [ ] Chiffrement : déjà déclaré « non soumis » (`usesNonExemptEncryption: false`)
- [ ] Informations pour la review : email + mot de passe du compte de démonstration, et une note :
      « La connexion se fait normalement par code email ; ce compte de démonstration utilise un mot
      de passe. La caméra du parc sera active à l'ouverture du parc. »

## 5. Points d'attention connus

- **Connexion sans compte** : on peut consulter le parc, le direct et l'offre sans compte (exigence
  Apple : pas de connexion forcée pour du contenu public). Le compte n'est demandé qu'à la réservation.
- **Suppression de compte** dans l'app : présente (onglet Compte), elle efface toutes les données.
- **Paiement** : aucun pour l'instant. Si un paiement en ligne est ajouté pour des services physiques
  (session au parc, coaching), il passe par Stripe/Mollie, pas par l'achat intégré Apple/Google.
- **Contenu minimal** : Apple rejette les apps « coquilles vides ». Avant l'ouverture du parc,
  l'app doit apporter une vraie valeur (réservation coaching, liste d'attente du parc, infos).
