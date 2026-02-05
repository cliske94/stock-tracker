#!/usr/bin/env bash
# Usage: scripts/post_metric.sh <service> <uptime_seconds> <requests>
SERVICE=${1:-demo_service}
UP=${2:-60}
REQS=${3:-1}
curl -s -X POST -H "Content-Type: application/json" -d \
  "{\"service\":\"${SERVICE}\",\"uptime\":${UP},\"requests\":${REQS}}" \
  http://localhost:8085/ingest | jq || true
