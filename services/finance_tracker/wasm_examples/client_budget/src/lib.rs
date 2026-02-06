use wasm_bindgen::prelude::*;

// Client-side helper to compute remaining budget and simple currency formatting.

#[wasm_bindgen]
pub fn remaining_budget(total: f64, spent: f64) -> f64 {
    if total < 0.0 || spent < 0.0 { return 0.0; }
    total - spent
}

#[wasm_bindgen]
pub fn format_currency(amount: f64, symbol: &str) -> String {
    format!("{}{:.2}", symbol, amount)
}
