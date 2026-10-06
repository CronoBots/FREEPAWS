# FreePaws

Coaching canin et **FreePaws Park** (parc canin clôturé, axe Liège – Huy – Waremme).

Ce dépôt contient :

| Dossier | Contenu |
|---|---|
| `/` (racine) | Site vitrine [www.freepaws.be](https://www.freepaws.be) (HTML statique) |
| [`mobile/`](mobile) | App iOS / Android : statut du parc en direct, caméra à deux temps, réservation en ligne, coaching, compte client, agenda admin |
| [`supabase/`](supabase) | Backend : base de données, règles de réservation, sécurité, Edge Function caméra, tests |
| [`docs/`](docs) | [Architecture](docs/ARCHITECTURE.md) · [Caméra](docs/CAMERA.md) · [Publication stores](docs/STORES.md) |

## Démarrage rapide

```bash
npx supabase start            # backend local (Docker)
supabase/tests/run.sh         # tests SQL
cd mobile && cp .env.example .env.local && npm install && npm start
```

## Contact

contact@freepaws.be · [Facebook](https://facebook.com/freepawspark) · [Instagram](https://instagram.com/freepawspark) · WhatsApp +32 497 79 40 74

---

<details>
<summary>Notes sur le site vitrine (import du 2026-10-06)</summary>

- Charte : polices Fraunces (titres) et Work Sans (texte) ; couleurs crème `#faf1e7`, encre `#2b3a30`,
  olive `#6c7746`, laiton `#a3823f`.
- À compléter : photo de profil (`votre-photo.jpg` absente), détail des offres, tarifs, formulaire de
  liste d'attente (actuellement `mailto:`), favicon, `robots.txt`, `sitemap.xml`, politique de
  confidentialité (requise par les stores).
</details>
