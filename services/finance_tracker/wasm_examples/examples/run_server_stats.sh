#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
WASM="$HERE/../server_stats/target/wasm32-wasip1/release/server_stats.wasm"
if ! command -v wasmtime >/dev/null; then
  echo "wasmtime not found; install from https://github.com/bytecodealliance/wasmtime"
  exit 2
fi
# Invoke exported mean_pair(a, b)
wasmtime "$WASM" --invoke mean_pair 1.5 4.5
