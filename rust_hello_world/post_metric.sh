#!/usr/bin/env bash
DASH=${DASHBOARD_URL:-http://dashboard:8085}
SERVICE=${METRIC_SERVICE:-rust_hello_world}
INTERVAL=${METRIC_INTERVAL:-30}

post_once(){
  curl -sS -X POST "$DASH/ingest" -H 'Content-Type: application/json' \
    -d "{\"service\":\"$SERVICE\",\"uptime\":$(date +%s),\"requests\":0}" >/dev/null 2>&1 || true
}

if [ "$1" = "--once" ]; then
  post_once
  exit 0
fi

while true; do
  post_once
  sleep "$INTERVAL"
done
