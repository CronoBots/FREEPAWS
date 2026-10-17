#!/usr/bin/env bash
# Export web de l'app (dossier dist/) pour une publication dans un sous-dossier ou à la racine.
#   EXPO_BASE_URL=/FREEPAWS/app EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_KEY=... scripts/export-web.sh
# EXPO_BASE_URL vide = racine du domaine (ex. app.freepaws.be).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
npx expo export --platform web
# Icône d'écran d'accueil et manifeste : chemins absolus pour fonctionner aussi sur les liens profonds.
sed -i "s#%APP_BASE%#${EXPO_BASE_URL:-}#g" dist/index.html
echo "Export prêt dans dist/ (base : ${EXPO_BASE_URL:-/})"
