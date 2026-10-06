# Architecture FreePaws

```
FREEPAWS/
├── index.html, *.html, Images/, Photos/   Site vitrine www.freepaws.be (statique)
├── mobile/                                App iOS / Android (Expo SDK 57)
│   ├── src/app/                           Routes Expo Router (un fichier = un écran)
│   ├── src/screens/                       Corps d'écrans volumineux
│   ├── src/components/                    UI réutilisable (charte FreePaws)
│   ├── src/api/                           Accès aux données (React Query + Supabase)
│   ├── src/lib/                           Client Supabase, session, auth
│   ├── src/utils/                         Dates (Bruxelles), erreurs, formats + tests
│   └── src/types/database.ts              Types générés depuis le schéma SQL
├── supabase/                              Backend
│   ├── migrations/                        Schéma, sécurité (RLS), fonctions métier
│   ├── functions/live-stream/             Edge Function : URLs caméra signées
│   ├── seed.sql                           Catalogue et horaires de départ
│   └── tests/                             Tests SQL (Postgres jetable)
└── docs/                                  Cette documentation
```

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| App iOS + Android | Expo (React Native), Expo Router | Un seul code, builds et publication cloud via EAS, mises à jour OTA |
| Backend | Supabase (Postgres, Auth, Edge Functions) — région UE | RGPD, sécurité au niveau des lignes (RLS), pas de serveur à maintenir |
| Connexion | Code à 6 chiffres par email | Pas de mot de passe ; conforme aux règles des stores |
| Données | React Query | Cache, rafraîchissement, états chargement / erreur / vide |
| Session | Trousseau iOS / Keystore Android (expo-secure-store) | Jeton jamais stocké en clair |

## Contenu : uniquement des infos réelles

Le catalogue (`supabase/seed.sql`) ne reprend que les textes de freepaws.be : aucun horaire, tarif ou
durée inventés. Tant qu'une prestation n'a pas ses horaires et règles fixés par FreePaws, sa réservation
en ligne reste fermée (`services.booking_enabled = false`) et l'app affiche « Prendre rendez-vous »
(email), comme le site. Le parc est « Pas encore ouvert » (`resources.is_open = false`).

Pour ouvrir la réservation d'une prestation : renseigner `duration_minutes`, `min_notice_hours`,
`max_advance_days`, `cancel_notice_hours` (et `buffer_minutes` pour le trajet), ajouter les horaires dans
`availability_rules`, puis passer `booking_enabled` à true.

## Règles métier (côté serveur, jamais dans l'app seule)

- **Pas de double réservation** : contrainte d'exclusion Postgres sur l'agenda de chaque ressource
  (le parc et la coach sont deux ressources indépendantes). Même deux clics simultanés ne peuvent pas
  réserver le même créneau.
- **Temps de trajet** : `buffer_minutes` bloque du temps avant et après une visite à domicile.
- **Délais** : réservation au plus tôt `min_notice_hours` avant, au plus tard `max_advance_days` ;
  annulation en ligne jusqu'à `cancel_notice_hours` avant (réglable par prestation).
- **Anti-abus** : 5 réservations à venir maximum par client.
- **Ateliers** : séances planifiées par l'admin avec un nombre de places ; la capacité est vérifiée
  sous verrou.
- **Caméra** : voir [CAMERA.md](CAMERA.md).

Toutes les heures sont stockées en UTC et affichées en heure de Bruxelles.

## Rôles

- **Visiteur** (sans compte) : statut du parc, direct public, catalogue, créneaux libres.
- **Client** : réserver, annuler, gérer ses chiens et son profil, supprimer son compte.
- **Admin** : agenda complet, coordonnées des clients, annulation, planification d'ateliers,
  accès caméra permanent. Le rôle se donne dans Supabase :
  `update profiles set role = 'admin' where email = 'contact@freepaws.be';`

## Développement local

```bash
# Backend (Docker requis)
npx supabase start                       # API sur :54321, boîte mail de test sur :54324
supabase/tests/run.sh                    # tests SQL (Postgres local ou DATABASE_URL)

# App
cd mobile
cp .env.example .env.local               # URL + clé publishable (locale ou projet)
npm install
npm start                                # QR code pour Expo Go, « w » pour le web
npm run check                            # types + lint + format + tests
```

Après toute migration : `npx supabase gen types typescript --local > mobile/src/types/database.ts`.
