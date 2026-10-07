# Rester chez Infomaniak

FreePaws garde son domaine, son site, sa messagerie et son agenda chez Infomaniak (cahier des charges
v1.1, section 1 et M1-10). Voici comment chaque brique s’y branche.

| Brique | Où | Comment |
| --- | --- | --- |
| Site freepaws.be | Infomaniak (inchangé) | Un bouton « Réserver » vers l’app web (ci-dessous). Pas de reconstruction. |
| App web (réservation, liens invités et secours) | Infomaniak, sous-domaine `app.freepaws.be` | Fichiers statiques exportés, voir « App web ». |
| Emails (confirmations, rappels, alertes, codes de connexion) | Messagerie Infomaniak | SMTP `mail.infomaniak.com`, port 465 : voir `docs/NOTIFICATIONS.md`. |
| Agenda | Agenda Infomaniak | Synchronisation dans les deux sens par iCal, voir « Agenda ». |
| Base de données, comptes clients, fichiers, fonctions serveur | Supabase, région UE (Francfort) | Voir « Pourquoi la base n’est pas chez Infomaniak ». |

## App web sur app.freepaws.be

1. Manager Infomaniak → Hébergement web → ajouter le sous-domaine `app.freepaws.be` (certificat SSL
   Let’s Encrypt activé).
2. Construire l’app web (depuis `mobile/`, avec les variables de production) :

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_… \
   EXPO_PUBLIC_APP_URL=https://app.freepaws.be \
   npx expo export --platform web
   ```

3. Envoyer le contenu du dossier `mobile/dist/` (y compris `.htaccess`, qui renvoie toutes les adresses
   vers l’app) à la racine du sous-domaine, par FTP/SFTP ou le gestionnaire de fichiers Infomaniak.
4. Dans Supabase (Authentication → URL Configuration), ajouter `https://app.freepaws.be` aux URL autorisées,
   et dans les secrets des fonctions : `APP_URL=https://app.freepaws.be` (liens des emails).

## Bouton de réservation sur freepaws.be

À coller dans l’éditeur du site (bloc HTML), sur chaque page de prestation ou dans le menu :

```html
<a href="https://app.freepaws.be/services"
   style="display:inline-block;padding:14px 22px;border-radius:10px;background:#2b3a30;color:#fff;text-decoration:none;font-weight:600">
  Réserver en ligne
</a>
```

Pour une prestation précise : `https://app.freepaws.be/service/<identifiant>` (ex. `bilan-cohabitation`).
Le même lien peut figurer sur freepawspark.com (`/service/park-session`) quand le parc ouvrira.

## Agenda Infomaniak

- **FreePaws → agenda Infomaniak** : dans l’app, Administration → accueil, copier le lien « Agenda externe »
  et l’ajouter dans l’agenda Infomaniak comme agenda abonné (adresse iCal).
- **Agenda Infomaniak → FreePaws** : récupérer l’adresse de partage iCal de l’agenda personnel (partage de
  l’agenda, lien ICS) et la coller dans Administration → Agenda personnel. Les rendez-vous personnels
  bloquent alors les créneaux de l’app, mis à jour toutes les 15 minutes. À vérifier avec le compte
  Infomaniak de FreePaws : le libellé exact de l’option de partage dans leur interface.

## Pourquoi la base n’est pas chez Infomaniak

Le cahier des charges accepte une autre solution « argumentée ». Arguments :

- **Fonctions nécessaires prêtes à l’emploi** : base de données, comptes clients avec code par email et
  double authentification, stockage privé des justificatifs, fonctions serveur planifiées (emails, alertes),
  règles d’accès par utilisateur. Chez Infomaniak, il faudrait installer, sécuriser et maintenir soi-même un
  serveur (Cloud Server) pour obtenir l’équivalent : plus de maintenance, donc plus de coût récurrent.
- **RGPD** : Supabase héberge le projet dans l’Union européenne (région Francfort), conforme à l’exigence
  « UE ou Suisse ».
- **Réversibilité** : base PostgreSQL standard, export complet possible à tout moment ; Supabase est
  open source et peut être réinstallé plus tard sur un serveur Infomaniak si FreePaws le souhaite.
