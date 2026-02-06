#!/usr/bin/env bash
set -euo pipefail
# Sync model_meta.json to the running three-renderer service.
SRC="$(dirname "$0")/../public/model_meta.json"
if [ ! -f "$SRC" ]; then echo "Source $SRC not found" >&2; exit 1; fi

# Try posting to a local dev endpoint on common ports
for PORT in 9092 19092; do
  if curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary @"$SRC" http://localhost:${PORT}/_dev/model_meta 2>/dev/null | grep -q "200"; then
    echo "Posted to localhost:${PORT}/_dev/model_meta";
    exit 0;
  fi
done

# Fallback: copy into the pod
POD=$(kubectl get pods -l app=three-renderer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$POD" ]; then
  kubectl cp "$SRC" ${POD}:/usr/src/app/public/model_meta.json
  echo "Copied to pod ${POD}:/usr/src/app/public/model_meta.json"
  exit 0
fi

echo "Could not post or copy; no reachable service or pod found" >&2
exit 2
