use wasm_bindgen::prelude::*;

// Simple statistics aggregation: mean, median, stddev for a slice of f64.

#[wasm_bindgen]
pub fn mean(values: &[f64]) -> f64 {
    if values.is_empty() { return 0.0; }
    let sum: f64 = values.iter().sum();
    sum / (values.len() as f64)
}

#[wasm_bindgen]
pub fn variance(values: &[f64]) -> f64 {
    let m = mean(values);
    let mut sumsq = 0.0;
    for v in values.iter() { sumsq += (v - m) * (v - m); }
    sumsq / (values.len() as f64)
}

#[wasm_bindgen]
pub fn stddev(values: &[f64]) -> f64 {
    variance(values).sqrt()
}

#[wasm_bindgen]
pub fn median(mut values: Vec<f64>) -> f64 {
    if values.is_empty() { return 0.0; }
    values.sort_by(|a,b| a.partial_cmp(b).unwrap());
    let n = values.len();
    if n % 2 == 1 { values[n/2] }
    else { (values[n/2 - 1] + values[n/2]) / 2.0 }
}

// C-style exported helpers for easy invocation from `wasmtime --invoke`.
#[no_mangle]
pub extern "C" fn mean_pair(a: f64, b: f64) -> f64 {
    (a + b) / 2.0
}

#[no_mangle]
pub extern "C" fn stddev_pair(a: f64, b: f64) -> f64 {
    let m = (a + b) / 2.0;
    (((a - m) * (a - m) + (b - m) * (b - m)) / 2.0).sqrt()
}
