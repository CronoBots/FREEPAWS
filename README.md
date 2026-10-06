# FreePaws — www.freepaws.be

Copie du site statique https://www.freepaws.be/ (récupérée le 2026-10-06) : HTML/CSS/JS en ligne, pas de framework ni de build.

## Identité
- **Nom** : FreePaws — « Les Fondations de l'Équilibre »
- **Activité** : coaching canin (prévention, cohabitation famille-chien, accompagnement à l'adoption) + projet **FreePaws Park** (parc canin clôturé, en préparation)
- **Zone** : Province de Liège, axe Liège – Huy – Waremme
- **Contact** : contact@freepaws.be · WhatsApp +32 497 79 40 74
- **Réseaux** : facebook.com/freepawspark · instagram.com/freepawspark

## Charte graphique
- Polices Google Fonts : **Fraunces** (titres, serif) et **Work Sans** (texte)
- Couleurs : crème `#faf1e7`, crème clair `#fdfaef`, encre `#2b3a30`, encre douce `#4a5c4c`, olive `#6c7746`, laiton `#a3823f`
- Motif : « colonne vertébrale » verticale avec repères (`FR—01`, `03`…), cartes qui se retournent (flip) au clic

## Pages
| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : 3 axes (accompagnement, orientation, parc libre), teaser du Park, bloc partenaires |
| `coaching.html` | 4 offres + « Pourquoi ce coaching existe » + relais pour professionnels de l'enfance |
| `bilan-cohabitation.html` | Bilan 2h à domicile, plan d'action personnalisé |
| `adoption-famille.html` | Accompagnement avant adoption + suivi 3 mois |
| `adoption-famille-atypique.html` | Idem, adapté à un enfant à besoins particuliers |
| `atelier-collectif.html` | Atelier « Mon enfant et mon chien », 1 à 4 familles, 2h |
| `journal-de-bord.html` | Avancement de FreePaws Park (formation Alpi/SAACE faite, enquête 110+ réponses, recherche terrain/CoDT en cours, ouverture avec réservation + caméra à venir), liste d'attente (mailto) |
| `qui-suis-je.html` | Histoire de la fondatrice (Sanji, Nami, 15 ans en petite enfance au Canada) |
| `partenaires.html` | Réseau partenaires : K9OPS / The Dog Gym (Huy) ; appel à devenir partenaire |

## Points à compléter sur le site actuel
- `qui-suis-je.html` référence `votre-photo.jpg`, absente du serveur (404) → « Photo à venir »
- Les pages détail d'offre indiquent « Le détail complet … sera ajouté prochainement »
- Pas de tarifs affichés
- Formulaire liste d'attente = simple `mailto:` (pas de stockage)
- Pas de favicon, `robots.txt` ni `sitemap.xml` (404)
- CSS dupliqué dans chaque page (pas de feuille de style commune)
