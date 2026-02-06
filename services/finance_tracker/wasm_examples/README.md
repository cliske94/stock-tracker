Wasm examples for the Finance Tracker

This folder contains four minimal Rust crates demonstrating WebAssembly usage:

- `server_currency` — small crate that converts currencies using fixed rates.
- `server_stats` — provides basic statistics (mean, median, stddev) over float arrays.
- `server_sse` — formats Server-Sent Events messages from event/data pairs.
- `client_budget` — client-side helpers for remaining budget and formatting.

Build and usage notes

1. Install Rust and wasm-pack or use `cargo build --target wasm32-unknown-unknown`.

2. For client-side (to be used in browser via wasm-bindgen):

   - Install `wasm-pack` and run `wasm-pack build client_budget --target web`.
   - Serve the generated `pkg/` files from your web server and import via JS.

3. For server-side usage (WASI or embedding in a runtime):

   - Build with `cargo build --release --target wasm32-wasi` (adjust crates to include `wasi`-compatible code).
   - Alternatively use `wasmtime` or `wasmer` to load the generated `.wasm` and call exported functions.

Examples

Client (JS):

```js
import init, { remaining_budget, format_currency } from './client_budget/pkg/client_budget.js'
await init();
const rem = remaining_budget(100.0, 34.5);
console.log(format_currency(rem, '$'));
```

Server (wasmtime CLI):

1. Build a `.wasm` for WASI target and run:

   wasmtime server_stats.wasm --invoke mean -- [1.0,2.0,3.0]

Note: these crates are minimal examples to demonstrate boundary crossing between Rust and host environments. They intentionally avoid heavy dependencies and are easy to adapt.
Wasm examples for Finance Tracker

This folder contains four Rust examples demonstrating WebAssembly usage:

- server_currency: simple currency conversion functions (wasm-bindgen, Node target)
- server_projection: monthly projection calculation (wasm-bindgen, Node target)
- server_utils: small utils (string hash) (wasm-bindgen, Node target)
- client_forecast: client-side forecast function (wasm-bindgen, web target)

Build instructions (requires Rust + wasm-pack):

1. Install toolchain and wasm-pack

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

2. Build server-side crates for Node (wasm-bindgen nodejs target)

```bash
cd wasm_examples/server_currency
wasm-pack build --target nodejs --out-dir pkg

cd ../server_projection
wasm-pack build --target nodejs --out-dir pkg

cd ../server_utils
wasm-pack build --target nodejs --out-dir pkg
```

3. Build client-side crate for the browser

```bash
cd ../client_forecast
wasm-pack build --target web --out-dir pkg
```

Examples:
- Node integration: `node_integration_example.js` shows how to require the generated `pkg` and call exported functions.
- Browser integration: serve `pkg` files from `public/` and import via ES module or instantiate via `wasm_bindgen` init.

Notes:
- These are minimal examples intended for demonstration and local development.
- For server-side production use, consider using a WASI runtime (wasmtime/wasmer) or compile as native Rust microservice when appropriate.
