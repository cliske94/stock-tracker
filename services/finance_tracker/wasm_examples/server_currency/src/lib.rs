use wasm_bindgen::prelude::*;

// A tiny example that converts currencies using a fixed rate table.
// This is for demonstration only and runs in WASI or wasm runtimes.

#[wasm_bindgen]
pub fn convert(amount: f64, from: &str, to: &str) -> f64 {
    let rates = vec![
        ("USD", 1.0),
        ("EUR", 0.85),
        ("JPY", 110.0),
        ("GBP", 0.75),
    ];
    let mut from_rate = 1.0;
    let mut to_rate = 1.0;
    for (c, r) in rates.iter() {
        if *c == from { from_rate = *r; }
        if *c == to { to_rate = *r; }
    }
    if from_rate == 0.0 || to_rate == 0.0 { return 0.0; }
    amount / from_rate * to_rate
}

// Simple integer-coded converter for direct wasm invocation.
// Codes: 0=USD,1=EUR,2=JPY,3=GBP
#[no_mangle]
pub extern "C" fn convert_code(amount: f64, from_code: i32, to_code: i32) -> f64 {
    let rates = [1.0f64, 0.85, 110.0, 0.75];
    let fi = from_code.max(0).min(3) as usize;
    let ti = to_code.max(0).min(3) as usize;
    let from_rate = rates[fi];
    let to_rate = rates[ti];
    if from_rate == 0.0 || to_rate == 0.0 { return 0.0; }
    amount / from_rate * to_rate
}
