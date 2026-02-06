#!/usr/bin/env bash
set -euo pipefail
# Forwards the three-renderer service port (container 9092) to localhost:9095
LOCAL_PORT=${1:-9095}
SERVICE=${2:-three-renderer}
LOG=/tmp/three_renderer_pf_${LOCAL_PORT}.log
PIDFILE=/tmp/three_renderer_pf_${LOCAL_PORT}.pid

POD=$(kubectl get pods -l app=${SERVICE} -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -z "$POD" ]; then echo "No pod found for service label app=${SERVICE}" >&2; exit 2; fi

echo "Starting port-forward: localhost:${LOCAL_PORT} -> 9092 (pod ${POD})"
kubectl port-forward pod/${POD} ${LOCAL_PORT}:9092 >"$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "Port-forwarding pid $(cat $PIDFILE), logs: $LOG"
