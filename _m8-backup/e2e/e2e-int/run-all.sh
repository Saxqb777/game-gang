#!/usr/bin/env bash
# M8 integration acceptance (spec 2.9), all items in order.
#
# Usage: bash /tmp/claude-0/e2e-int/run-all.sh [HTTP_PORT] [HTTPS_PORT] [WORKTREE]
#   defaults: 4000 4443 /home/user/m8-wt/int
#   env: TAG=<prefix> for logs and screenshots (default "int")
#        SKIP_GATE=1 skips item 1 (gate + build:vercel), for re-running the browser scripts only
#        RACE_MIN / BENCH_MIN override the race and benchmark timeouts (minutes)
#        SCRIPTS="int-race int-bench" (default) picks which browser scripts run
#
# Steps: 1 gate, 1 build:vercel + output files, then a dev server (an existing one on HTTP_PORT is
# reused only if it runs from WORKTREE; otherwise one is started with nohup and stopped at the end),
# then int-race.cjs (items 2-5, 7) and int-bench.cjs (items 6, 7), each under the shared browser lock.
# Logs: /tmp/claude-0/e2e-int/$TAG-*.log. Exit code 0 only if every check passed.
set -u
HTTP_PORT=${1:-4000}
HTTPS_PORT=${2:-4443}
WT=${3:-/home/user/m8-wt/int}
TAG=${TAG:-int}
DIR=/tmp/claude-0/e2e-int
LOCK=/tmp/claude-0/m8-browser.lock
export TAG
fails=0
failed_steps=''
started_pid=''

say() { echo "$(date -u +%H:%M:%S) $*"; }
pass() { say "PASS [2.9-$1] $2"; }
fail() {
  say "FAIL [2.9-$1] $2"
  fails=$((fails + 1))
  failed_steps="$failed_steps
  FAIL [2.9-$1] $2"
}

stop_server() {
  if [ -n "$started_pid" ]; then
    pkill -P "$started_pid" 2>/dev/null
    kill "$started_pid" 2>/dev/null
    # tsx starts node grandchildren; stop anything still holding our ports.
    for port in "$HTTP_PORT" "$HTTPS_PORT"; do
      pid=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
      [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
    say "stopped the dev server started by this run (pid $started_pid)"
    started_pid=''
  fi
}
trap stop_server EXIT

[ -d "$WT" ] || { say "no worktree at $WT"; exit 2; }
# Rule 3: without .env the server uses in-memory PGlite, so no test data reaches Neon.
if [ -e "$WT/.env" ]; then
  say "refusing to run: $WT/.env exists (would write test laps and telemetry to Neon)"
  exit 2
fi
say "M8 integration acceptance: worktree $WT ($(git -C "$WT" rev-parse --short HEAD)), ports $HTTP_PORT/$HTTPS_PORT, tag $TAG"

# ---- Item 1: gate and build:vercel -------------------------------------------------------------
if [ "${SKIP_GATE:-0}" != 1 ]; then
  if (cd "$WT" && sh /tmp/claude-0/m8-gate.sh) > "$DIR/$TAG-gate.log" 2>&1; then
    pass 1 "M8 gate green (log $DIR/$TAG-gate.log)"
  else
    fail 1 "M8 gate failed (tail of $DIR/$TAG-gate.log below)"
    tail -25 "$DIR/$TAG-gate.log"
  fi
  if (cd "$WT" && pnpm build:vercel) > "$DIR/$TAG-build-vercel.log" 2>&1; then
    pass 1 "pnpm build:vercel green (log $DIR/$TAG-build-vercel.log)"
  else
    fail 1 "pnpm build:vercel failed (tail below)"
    tail -25 "$DIR/$TAG-build-vercel.log"
  fi
  for f in .vercel/output/static/tracks/kestrel-pines/base.layout.json \
           .vercel/output/static/tracks/kestrel-pines/overrides.json \
           .vercel/output/functions/api/telemetry.func/index.js \
           .vercel/output/functions/api/laps.func/index.js; do
    if [ -e "$WT/$f" ]; then pass 1 "$f present"; else fail 1 "$f missing"; fi
  done
else
  say "SKIP item 1 (SKIP_GATE=1)"
fi

# ---- Dev server ------------------------------------------------------------------------------------
up() { curl -s -o /dev/null -m 5 "http://localhost:$HTTP_PORT/tv"; }
if up; then
  pid=$(lsof -t -iTCP:"$HTTP_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null)
  if [ "$cwd" != "$WT" ]; then
    say "port $HTTP_PORT is served by pid $pid from '$cwd', not $WT; stop it or pick other ports"
    exit 2
  fi
  say "reusing the dev server already running from $WT (pid $pid)"
else
  (cd "$WT" && PORT=$HTTP_PORT HTTPS_PORT=$HTTPS_PORT nohup pnpm dev > "$DIR/$TAG-dev.log" 2>&1 &
   echo $! > "$DIR/$TAG-dev.pid")
  started_pid=$(cat "$DIR/$TAG-dev.pid")
  say "started dev server pid $started_pid (log $DIR/$TAG-dev.log)"
  for _ in $(seq 1 90); do up && break; sleep 2; done
  up || { say "dev server did not answer on $HTTP_PORT"; exit 2; }
  # Warm Vite's dependency optimiser so the first TV load is not a cold one.
  curl -s -o /dev/null -m 120 "http://localhost:$HTTP_PORT/tv"
  sleep 5
fi

# ---- Browser scripts, one at a time under the shared lock -------------------------------------
for script in ${SCRIPTS:-int-race int-bench}; do
  say "running $script (waiting for $LOCK)"
  flock "$LOCK" node "$DIR/$script.cjs" "$HTTP_PORT" "$HTTPS_PORT" 2>&1 | tee "$DIR/$TAG-$script.log"
  code=${PIPESTATUS[0]}
  if [ "$code" = 0 ]; then pass run "$script exited 0"; else fail run "$script exited $code"; fi
done

stop_server

# ---- Summary ----------------------------------------------------------------------------------------
echo
say "SUMMARY ($TAG)"
[ -n "$failed_steps" ] && say "failed steps:$failed_steps"
logs=""
for script in ${SCRIPTS:-int-race int-bench}; do logs="$logs $DIR/$TAG-$script.log"; done
# shellcheck disable=SC2086
say "browser checks: $(grep -h -oE 'PASS \[2\.9-[^]]*\] .*' $logs 2>/dev/null | wc -l) PASS, $(grep -h -oE '^[0-9:]+ FAIL \[2\.9-[^]]*\] .*' $logs 2>/dev/null | wc -l) FAIL"
# shellcheck disable=SC2086
grep -h -E '^[0-9:]+ FAIL \[2\.9-' $logs 2>/dev/null | sed 's/^[0-9:]* /  /'
say "screenshots: $(ls "$DIR"/"$TAG"-*.png 2>/dev/null | tr '\n' ' ')"
if [ "$fails" = 0 ]; then say "M8 integration acceptance: PASS"; exit 0; fi
say "M8 integration acceptance: FAIL ($fails step(s) failed)"
exit 1
