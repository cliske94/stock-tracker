use wasm_bindgen::prelude::*;

// Small helper to format SSE (Server-Sent Events) messages.

#[wasm_bindgen]
pub fn sse_message(event: &str, data: &str) -> String {
    let mut out = String::new();
    if !event.is_empty() {
        out.push_str("event: ");
        out.push_str(event);
        out.push('\n');
    }
    for line in data.lines() {
        out.push_str("data: ");
        out.push_str(line);
        out.push('\n');
    }
    out.push('\n');
    out
}

// WASI-friendly helper that prints a demo SSE message to stdout when invoked.
#[no_mangle]
pub extern "C" fn sse_print() -> i32 {
    println!("event: demo");
    println!("data: hello from wasm\n");
    0
}
