#!/usr/bin/env bash
#
# Runs the row level security test suite against a throwaway Postgres cluster.
#
#   ./scripts/test-rls.sh
#
# The suite checks the properties the app leans on: clients see only their own
# records, drafts stay hidden, clients cannot write payment state or promote
# themselves, and invoice totals are derived rather than trusted.
#
# Set PG_BIN if your Postgres binaries live somewhere unusual.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"

if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Could not find Postgres binaries. Install Postgres, or set PG_BIN." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
PORT="${PGPORT:-5455}"
cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORKDIR/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "→ Provisioning a scratch cluster in $WORKDIR"
"$PG_BIN/initdb" -D "$WORKDIR/data" -A trust >/dev/null
mkdir -p "$WORKDIR/run"
"$PG_BIN/pg_ctl" -D "$WORKDIR/data" \
  -o "-k $WORKDIR/run -p $PORT -c listen_addresses=''" \
  -l "$WORKDIR/pg.log" start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORKDIR/run" -p "$PORT" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c 'create database snowbook_test;' >/dev/null

echo "→ Applying the Supabase stand-ins (auth schema, roles)"
"${PSQL[@]}" -d snowbook_test -f "$ROOT/supabase/tests/00_harness.sql" >/dev/null

echo "→ Applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d snowbook_test -f "$migration" >/dev/null 2>&1
done

echo "→ Running tests"
"${PSQL[@]}" -d snowbook_test -f "$ROOT/supabase/tests/10_rls_test.sql" 2>&1 |
  grep -E "NOTICE:|FAIL|PASSED" |
  sed 's/^.*NOTICE:  //'
