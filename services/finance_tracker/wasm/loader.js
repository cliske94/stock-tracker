const fs = require('fs');
const path = require('path');
const { WASI } = require('wasi');

async function tryInstantiate(wasmPath) {
  const bytes = fs.readFileSync(wasmPath);
  // first try instantiate without wasi
  try {
    const mod = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(mod, {});
    return instance.exports;
  } catch (e) {
    // fallback to WASI
    const wasi = new WASI({ args: [], env: process.env });
    const importObj = { wasi_snapshot_preview1: wasi.wasiImport };
    const mod = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(mod, importObj);
    // Only call wasi.start if the module exports a `_start` function.
    // Some wasm builds export functions directly and do not provide a `_start` entrypoint,
    // in which case calling `wasi.start` will throw. In that case return the exports
    // and let the caller invoke exported functions directly.
    if (instance.exports && typeof instance.exports._start === 'function') {
      wasi.start(instance);
    }
    return instance.exports;
  }
}

async function init() {
  const base = path.join(__dirname, '..', 'wasm_examples');
  const modules = {};
  try {
    modules.server_currency = await tryInstantiate(path.join(base, 'server_currency', 'target', 'wasm32-wasip1', 'release', 'server_currency.wasm'));
  } catch (e) {
    console.warn('failed to load server_currency wasm:', e.message);
    modules.server_currency = null;
  }
  try {
    modules.server_stats = await tryInstantiate(path.join(base, 'server_stats', 'target', 'wasm32-wasip1', 'release', 'server_stats.wasm'));
  } catch (e) {
    console.warn('failed to load server_stats wasm:', e.message);
    modules.server_stats = null;
  }
  try {
    modules.server_sse = await tryInstantiate(path.join(base, 'server_sse', 'target', 'wasm32-wasip1', 'release', 'server_sse.wasm'));
  } catch (e) {
    console.warn('failed to load server_sse wasm:', e.message);
    modules.server_sse = null;
  }
  return modules;
}

module.exports = { init };
