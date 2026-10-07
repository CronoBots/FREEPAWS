# Notifications par email

## Ce qui est envoyé

| Événement | Client | Administratrice |
| --- | --- | --- |
| Réservation | Confirmation + copie des documents acceptés | Alerte « Nouvelle réservation » |
| Report | « Réservation déplacée » | Alerte |
| Annulation (par le client, l’admin ou une fermeture) | « Réservation annulée » | Alerte (sauf si elle annule elle-même) |
| X heures avant le rendez-vous (48 h par défaut) | Rappel | — |
| Assurance ou vaccin exigé qui expire dans les 30 jours (réglable) | Alerte | Récapitulatif des documents échus |
| Vaccination ajoutée ou modifiée | Résultat de la validation | « Vaccination à valider » |
| Créneau libéré un jour où il est inscrit en liste d’attente | Alerte | — |
| Bouton « Urgence » pendant une réservation | — | Alerte immédiate (identité, créneau, contact d’urgence) |
| 30 min avant un créneau du parc | Chaque invité ayant un email reçoit son lien live personnel | — |

- L’email du client part dans la langue choisie dans l’app (`profiles.language`, FR ou EN).
- L’adresse des alertes et le délai du rappel se règlent dans l’app : **Compte → Administration**.
  Sans adresse, aucune alerte n’est envoyée.
- Un rendez-vous pris moins de 48 h à l’avance n’a pas de rappel. Un report recale le rappel.

## Fonctionnement

1. Des triggers sur `bookings` écrivent dans `public.notifications` (migration
   `20261008120000_notifications.sql`), dans la même transaction que la réservation.
2. L’Edge Function `send-notifications` réclame les lignes dues (`claim_notifications`, sans doublon,
   5 tentatives au plus), compose l’email et l’envoie via [Resend](https://resend.com).
3. pg_cron appelle la fonction chaque minute.

Les erreurs d’envoi restent visibles dans `notifications.last_error` (lecture admin).

## Mise en service (une fois le projet Supabase créé)

1. Choisir l’envoi :
   - **Infomaniak (recommandé, FreePaws y a déjà son domaine et sa messagerie)** : créer une adresse
     d’envoi (ex. `reservations@freepaws.be`) dans le Manager Infomaniak. Serveur `mail.infomaniak.com`,
     port 465 (SSL). Les Edge Functions Supabase n’autorisent pas les ports 25 et 587 : garder le 465.
   - ou **Resend** : créer un compte et vérifier le domaine (enregistrements DNS à ajouter chez Infomaniak).
   - Les emails de connexion (code à 6 chiffres) passent par Supabase Auth : dans le tableau de bord,
     Authentication → Emails → SMTP Settings, renseigner le même serveur Infomaniak.
2. Secrets de la fonction :

   ```bash
   # Infomaniak :
   npx supabase secrets set SMTP_HOST=mail.infomaniak.com SMTP_PORT=465 \
     SMTP_USER=reservations@freepaws.be SMTP_PASSWORD='…' \
     NOTIFY_FROM="FreePaws <reservations@freepaws.be>" \
     NOTIFY_CRON_SECRET=$(openssl rand -hex 32)
   # ou Resend à la place de SMTP_* : RESEND_API_KEY=re_xxx
   npx supabase functions deploy send-notifications calendar-import
   # Lien live des invités : adresse web de l'app si elle est publiée (sinon freepaws:// ouvre l'app).
   npx supabase secrets set APP_URL=https://app.freepaws.be
   ```

3. Planifier l’appel (SQL Editor du tableau de bord). Activer d’abord les extensions `pg_cron` et
   `pg_net` (Database → Extensions), puis :

   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-notifications', 'notify_url');
   select vault.create_secret('<NOTIFY_CRON_SECRET>', 'notify_secret');

   select cron.schedule('send-notifications', '* * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret'),
         'Content-Type', 'application/json'),
       body := '{}'::jsonb
     );
   $$);

   -- Import des agendas personnels (Administration → Agenda personnel) : toutes les 15 minutes.
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/calendar-import', 'calendar_import_url');
   select cron.schedule('calendar-import', '*/15 * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_import_url'),
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret'),
         'Content-Type', 'application/json'),
       body := '{}'::jsonb
     );
   $$);

   -- Alertes d'échéance (assurance, vaccins) : chaque jour à 7 h 55 (heure UTC).
   select cron.schedule('expiry-alerts', '55 7 * * *', $$ select public.enqueue_expiry_alerts() $$);
   ```

Sans ces secrets la fonction répond `503 not_configured` et la file reste intacte : rien n’est perdu,
tout part dès la configuration terminée.

## Test local

`supabase/tests/notifications.test.sql` vérifie la file (confirmation, report, annulation, rappel,
réclamation sans doublon). Pour tester l’envoi sans Resend, lancer la fonction avec
`RESEND_API_URL` pointant vers un faux serveur qui enregistre les requêtes.
