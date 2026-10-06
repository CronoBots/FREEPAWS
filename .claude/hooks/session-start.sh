#!/bin/bash
# Installe les dépendances de l'app pour que lint, typecheck et tests fonctionnent
# dans les sessions Claude Code cloud.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/mobile"
npm install --no-audit --no-fund --loglevel=error

# Binaires Postgres pour supabase/tests/run.sh (présents dans l'image par défaut).
if ! ls -d /usr/lib/postgresql/*/bin >/dev/null 2>&1; then
  echo "Postgres absent : les tests SQL (supabase/tests/run.sh) ne pourront tourner qu'avec DATABASE_URL." >&2
fi
