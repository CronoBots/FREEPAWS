# Caméra du parc — accès à deux temps

> « Parc libre : consultez le direct pour découvrir le parc à tout moment : sa disponibilité, mais aussi
> son état du moment — pluie, neige, terrain praticable — avant de vous déplacer.
> Parc réservé : l'accès devient privé, conformément à la protection de la vie privée. Vous gardez un
> œil sur votre chien — utile si le rappel n'est pas encore acquis — et je garde un accès en cas
> d'incident. » — freepaws.be

## Qui voit quoi

| Situation du parc | Visiteur / autre client | Client du créneau en cours | Admin |
|---|---|---|---|
| Libre (heures d'ouverture, pas de session) | Direct public | Direct public | Direct |
| Réservé (session en cours) | « Session privée en cours » | **Direct privé** | Direct |
| Fermé (hors horaires, période bloquée) | « Parc fermé » | « Parc fermé » | Direct |

La décision est prise **uniquement par la base de données** (`camera_access()`), testée dans
`supabase/tests/booking.test.sql`.

## Fonctionnement technique

1. L'app appelle l'Edge Function `live-stream` (avec le jeton de l'utilisateur s'il est connecté).
2. La fonction demande `camera_access('park')` → mode (`public`, `private`, `admin`, `denied`) et
   une date d'expiration (au plus 10 minutes, et jamais au-delà de la fin de l'état courant).
3. Si l'accès est accordé, elle renvoie pour chaque caméra une URL HLS **signée** :

   ```
   {CAMERA_BASE_URL}/{expires}/{signature}/{stream_path}/index.m3u8
   signature = base64url( HMAC-SHA256( CAMERA_SIGNING_SECRET, "{stream_path}:{expires}" ) )
   ```

   La signature est **dans le chemin** : le lecteur HLS résout les segments (`segment123.ts`)
   relativement à la playlist, ils portent donc automatiquement le même préfixe signé.

4. L'app renouvelle l'URL avant son expiration. Une URL obtenue quand le parc était libre
   **cesse de fonctionner** dès que la session privée commence (expiration courte).

## Ce que doit faire le serveur vidéo (à l'installation des caméras)

- Recevoir les flux des caméras (RTSP) et les publier en HLS — par exemple **MediaMTX** sur un petit
  serveur ou un mini-PC sur place, ou un service géré (Cloudflare Stream, Mux…).
- **Refuser toute requête** (playlist **et** segments) dont la signature est invalide ou dont `expires`
  est dépassé : extraire `{expires}/{signature}/{stream_path}` du chemin, recalculer le HMAC, comparer,
  puis servir le fichier sans ce préfixe (petit reverse-proxy, ex. Caddy/nginx + script, ou Cloudflare Worker).
- Ne pas enregistrer les images (ou définir une durée de conservation et l'indiquer dans la
  politique de confidentialité).

## Mise en service

1. Installer les caméras + le serveur vidéo, choisir un secret long et aléatoire.
2. `npx supabase secrets set CAMERA_BASE_URL=https://live.freepaws.be/hls CAMERA_SIGNING_SECRET=...`
3. `npx supabase functions deploy live-stream`
4. Déclarer chaque caméra dans la table `cameras` (`stream_path`, ex. `park/main`).

Tant que ces secrets ne sont pas définis, l'app affiche « Direct bientôt disponible ».

## Points à valider

- Panneau d'information sur place (vidéosurveillance, loi caméras belge) et déclaration éventuelle.
- Cadrage : le terrain, pas la voie publique ni les voisins.
