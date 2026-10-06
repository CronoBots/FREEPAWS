#!/usr/bin/env bash
# Lance les tests SQL sur un Postgres jetable : stub Supabase + migrations + seed + tests.
# Usage : supabase/tests/run.sh            (Postgres local, binaires dans PG_BIN)
#         DATABASE_URL=postgres://... supabase/tests/run.sh   (base existante, ex. CI)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  tmp="$(mktemp -d)"
  chmod 777 "$tmp"
  as_pg=()
  if [[ "$(id -u)" == "0" ]]; then as_pg=(runuser -u postgres --); fi
  "${as_pg[@]}" "$PG_BIN/initdb" -D "$tmp/data" -U postgres -A trust >/dev/null
  "${as_pg[@]}" "$PG_BIN/pg_ctl" -D "$tmp/data" -o "-k $tmp -p 54329 -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null
  trap '"${as_pg[@]}" "$PG_BIN/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null; rm -rf "$tmp"' EXIT
  DATABASE_URL="postgresql://postgres@/postgres?host=$tmp&port=54329"
fi

psql_run() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_run -f "$here/supabase_stub.sql"
for f in "$root"/migrations/*.sql; do psql_run -f "$f"; done
psql_run -f "$root/seed.sql"
for f in "$here"/*.test.sql; do
  echo "→ $(basename "$f")"
  psql_run -o /dev/null -f "$f"
done
echo "OK : tous les tests SQL passent."
