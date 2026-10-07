# Notifications par email

## Ce qui est envoyé

| Événement | Client | Administratrice |
| --- | --- | --- |
| Réservation | Confirmation + copie des documents acceptés | Alerte « Nouvelle réservation » |
| Report | « Réservation déplacée » | Alerte |
| Annulation (par le client, l’admin ou une fermeture) | « Réservation annulée » | Alerte (sauf si elle annule elle-même) |
| X heures avant le rendez-vous (48 h par défaut) | Rappel | — |

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

1. Créer un compte Resend et vérifier le domaine d’envoi (`freepaws.be`) : enregistrements DNS
   fournis par Resend, à ajouter chez l’hébergeur du domaine.
2. Secrets de la fonction :

   ```bash
   npx supabase secrets set RESEND_API_KEY=re_xxx \
     NOTIFY_FROM="FreePaws <reservations@freepaws.be>" \
     NOTIFY_CRON_SECRET=$(openssl rand -hex 32)
   npx supabase functions deploy send-notifications
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
   ```

Sans ces secrets la fonction répond `503 not_configured` et la file reste intacte : rien n’est perdu,
tout part dès la configuration terminée.

## Test local

`supabase/tests/notifications.test.sql` vérifie la file (confirmation, report, annulation, rappel,
réclamation sans doublon). Pour tester l’envoi sans Resend, lancer la fonction avec
`RESEND_API_URL` pointant vers un faux serveur qui enregistre les requêtes.
