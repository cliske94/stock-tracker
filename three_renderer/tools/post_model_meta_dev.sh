#!/usr/bin/env bash
set -euo pipefail
# Posts three_renderer/public/model_meta.json to local dev endpoint or falls back to kubectl copy to the pod.
ROOT=$(dirname "$(realpath "$0")")/..
SRC="$ROOT/public/model_meta.json"
if [ ! -f "$SRC" ]; then echo "Source $SRC not found" >&2; exit 1; fi

for PORT in 9092 19092; do
  if curl -sS -X POST -H "Content-Type: application/json" --data-binary @"$SRC" http://localhost:${PORT}/_dev/model_meta >/dev/null 2>&1; then
    echo "Posted to http://localhost:${PORT}/_dev/model_meta";
    exit 0
  fi
done

POD=$(kubectl get pods -l app=three-renderer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$POD" ]; then
  kubectl cp "$SRC" ${POD}:/usr/src/app/public/model_meta.json
  echo "Copied to pod ${POD}:/usr/src/app/public/model_meta.json"
  exit 0
fi

echo "No local endpoint or pod found" >&2
exit 2
