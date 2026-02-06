#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
WASM="$HERE/../server_sse/target/wasm32-wasip1/release/server_sse.wasm"
if ! command -v wasmtime >/dev/null; then
  echo "wasmtime not found; install from https://github.com/bytecodealliance/wasmtime"
  exit 2
fi
# call sse_print which prints a demo SSE message to stdout
wasmtime "$WASM" --invoke sse_print
