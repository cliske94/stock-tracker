#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
WASM="$HERE/../server_currency/target/wasm32-wasip1/release/server_currency.wasm"
if ! command -v wasmtime >/dev/null; then
  echo "wasmtime not found; install from https://github.com/bytecodealliance/wasmtime"
  exit 2
fi
# invoke convert_code(amount, from_code, to_code)
# codes: 0=USD,1=EUR,2=JPY,3=GBP
wasmtime "$WASM" --invoke convert_code 100.0 0 1
