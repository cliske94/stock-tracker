#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Running tests..."

g++ HelloWorld.cpp -o hello_test
OUT=$(./hello_test)
if [[ "$OUT" != "Hello, World!" ]]; then
  echo "HelloWorld test failed: expected 'Hello, World!', got: '$OUT'"
  exit 1
fi
echo "HelloWorld test passed"

g++ examples/HelloArgs.cpp src/greetings.cpp -o hello_args_test -std=c++17
OUT1=$(./hello_args_test)
OUT2=$(./hello_args_test Alice)
if [[ "$OUT1" != "Hello, World!" ]]; then
  echo "HelloArgs default test failed: expected 'Hello, World!', got: '$OUT1'"
  exit 1
fi
if [[ "$OUT2" != "Hello, Alice!" ]]; then
  echo "HelloArgs arg test failed: expected 'Hello, Alice!', got: '$OUT2'"
  exit 1
fi
echo "HelloArgs tests passed"

# Multithreaded example
g++ examples/HelloThreads.cpp -o hello_threads_test -pthread -std=c++17
OUTT=$(./hello_threads_test)
EXPECTED=$'Hello from thread 0!\nHello from thread 1!\nHello from thread 2!\nHello from thread 3!'
if [[ "$OUTT" != "$EXPECTED" ]]; then
  echo "HelloThreads test failed: expected:\n$EXPECTED\ngot:\n$OUTT"
  exit 1
fi
echo "HelloThreads test passed"

echo "All tests passed"
