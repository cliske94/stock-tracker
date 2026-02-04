use reqwest::blocking::Client;
use serde_json::json;
use std::time::Duration;
use std::sync::{Arc, Mutex};
use dotenvy::dotenv;
use sdl2::event::Event;
use sdl2::keyboard::Keycode;

const TOKEN_FILE: &str = "token.txt";

fn backend_base() -> String {
    std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://host.docker.internal:8080".to_string())
}

fn http_post_json(url: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("rust-client/0.1")
        .build()
        .map_err(|e| format!("client build: {}", e))?;
    let res = client
        .post(url)
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("send: {}", e))?;
    let status = res.status();
    let txt = res.text().map_err(|e| format!("read: {}", e))?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), txt));
    }
    serde_json::from_str(&txt).map_err(|e| format!("parse json: {} - raw: {}", e, txt))
}

fn http_get_json(url: &str, token: Option<String>) -> Result<serde_json::Value, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("rust-client/0.1")
        .build()
        .map_err(|e| format!("client build: {}", e))?;
    let mut req = client.get(url);
    if let Some(t) = token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    let res = req.send().map_err(|e| format!("send: {}", e))?;
    let status = res.status();
    let txt = res.text().map_err(|e| format!("read: {}", e))?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), txt));
    }
    serde_json::from_str(&txt).map_err(|e| format!("parse json: {} - raw: {}", e, txt))
}

fn persist_token(token: &str) {
    let _ = std::fs::write(TOKEN_FILE, token);
}

fn load_token() -> Option<String> {
    std::fs::read_to_string(TOKEN_FILE).ok()
}

enum Focus {
    None,
    Username,
    Password,
    Search,
}

#[derive(PartialEq)]
enum MenuMode {
    None,
    Login,
    Search,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenv();

    let sdl_ctx = sdl2::init()?;
    let ttf_ctx = sdl2::ttf::init().map_err(|e| format!("TTF init: {}", e))?;
    let video = sdl_ctx.video()?;
    let window = video.window("Rust Stock UI", 1000, 500).position_centered().build()?;
    let mut canvas = window.into_canvas().present_vsync().build()?;
    let texture_creator = canvas.texture_creator();
    let font = ttf_ctx.load_font("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)?;

    let status = Arc::new(Mutex::new(String::from("Ready")));
    let token = Arc::new(Mutex::new(load_token()));

    let mut username = String::new();
    let mut password = String::new();
    let mut search_input = String::new();
    let mut focus = Focus::None;
    let mut mode = MenuMode::None;

    let username_box = sdl2::rect::Rect::new(20, 120, 420, 36);
    let password_box = sdl2::rect::Rect::new(20, 180, 420, 36);
    let register_box = sdl2::rect::Rect::new(180, 240, 140, 40);
    let login_box = sdl2::rect::Rect::new(40, 240, 120, 40);
    let search_box = sdl2::rect::Rect::new(20, 80, 420, 36);
    let search_button = sdl2::rect::Rect::new(460, 80, 120, 36);
    // top menu
    let menu_login = sdl2::rect::Rect::new(20, 20, 120, 28);
    let menu_search = sdl2::rect::Rect::new(160, 20, 140, 28);

    let mut event_pump = sdl_ctx.event_pump()?;
    'running: loop {
        for event in event_pump.poll_iter() {
            match event {
                Event::Quit { .. } => break 'running,
                Event::KeyDown { keycode: Some(Keycode::Escape), .. } => break 'running,
                Event::KeyDown { keycode: Some(Keycode::Backspace), .. } => match focus {
                    Focus::Username => { username.pop(); }
                    Focus::Password => { password.pop(); }
                    _ => {}
                },
                Event::KeyDown { keycode: Some(Keycode::Return), .. } => match focus {
                    Focus::Username => { focus = Focus::None; let mut s = status.lock().unwrap(); *s = format!("Username set: {}", username); }
                    Focus::Password => { focus = Focus::None; let mut s = status.lock().unwrap(); *s = "Password set".to_string(); }
                    Focus::Search => { focus = Focus::None; let mut s = status.lock().unwrap(); *s = format!("Search set: {}", search_input); }
                    _ => {}
                },
                Event::TextInput { text, .. } => match focus {
                    Focus::Username => username.push_str(&text),
                    Focus::Password => password.push_str(&text),
                    Focus::Search => search_input.push_str(&text),
                    _ => {}
                },
                Event::MouseButtonDown { x, y, .. } => {
                    let p = sdl2::rect::Point::new(x as i32, y as i32);
                    if menu_login.contains_point(p) { mode = MenuMode::Login; focus = Focus::None; }
                    else if menu_search.contains_point(p) { mode = MenuMode::Search; focus = Focus::None; }
                    else if mode == MenuMode::Search && search_box.contains_point(p) { focus = Focus::Search; }
                    else if mode == MenuMode::Search && search_button.contains_point(p) {
                        let si = search_input.clone(); let st = status.clone(); let tk = token.clone();
                        std::thread::spawn(move || {
                            let base = backend_base();
                            let url = format!("{}/search?ticker={}", base, urlencoding::encode(&si));
                            let token_opt = tk.lock().unwrap().clone();
                            match http_get_json(&url, token_opt) {
                                Ok(v) => {
                                    let mut s = st.lock().unwrap(); *s = format!("Search OK: {}", v);
                                }
                                Err(e) => { let mut s = st.lock().unwrap(); *s = format!("Search failed: {}", e); }
                            }
                        });
                    } else if mode == MenuMode::Login && username_box.contains_point(p) { focus = Focus::Username; }
                    else if mode == MenuMode::Login && password_box.contains_point(p) { focus = Focus::Password; }
                    else if mode == MenuMode::Login && login_box.contains_point(p) {
                        let u = username.clone(); let pss = password.clone(); let st = status.clone(); let tk = token.clone();
                        std::thread::spawn(move || {
                            let base = backend_base();
                            let url = format!("{}/auth/login", base);
                            let body = json!({"username": u, "password": pss});
                            match http_post_json(&url, body) {
                                Ok(v) => {
                                    if let Some(t) = v.get("token").and_then(|t| t.as_str()) {
                                        persist_token(t);
                                        let mut th = tk.lock().unwrap(); *th = Some(t.to_string());
                                        let mut s = st.lock().unwrap(); *s = "Login successful".to_string();
                                    } else {
                                        let mut s = st.lock().unwrap(); *s = format!("Login: unexpected response: {}", v);
                                    }
                                }
                                Err(e) => { let mut s = st.lock().unwrap(); *s = format!("Login failed: {}", e); }
                            }
                        });
                    } else if mode == MenuMode::Login && register_box.contains_point(p) {
                        let u = username.clone(); let p = password.clone(); let st = status.clone(); let tk = token.clone();
                        std::thread::spawn(move || {
                            let base = backend_base();
                            let url = format!("{}/auth/register", base);
                            let body = json!({"username": u, "password": p});
                            match http_post_json(&url, body) {
                                Ok(v) => {
                                    if let Some(t) = v.get("token").and_then(|t| t.as_str()) {
                                        persist_token(t);
                                        let mut th = tk.lock().unwrap(); *th = Some(t.to_string());
                                        let mut s = st.lock().unwrap(); *s = "Register successful".to_string();
                                    } else {
                                        let mut s = st.lock().unwrap(); *s = format!("Register: unexpected response: {}", v);
                                    }
                                }
                                Err(e) => { let mut s = st.lock().unwrap(); *s = format!("Register failed: {}", e); }
                            }
                        });
                    } else { focus = Focus::None; }
                }
                _ => {}
            }
        }

        canvas.set_draw_color(sdl2::pixels::Color::RGB(20,20,30));
        canvas.clear();

        // draw top menu
        let m1 = font.render("Login").blended(sdl2::pixels::Color::RGB(220,220,220))?;
        canvas.copy(&texture_creator.create_texture_from_surface(&m1)?, None, Some(menu_login))?;
        let m2 = font.render("Search").blended(sdl2::pixels::Color::RGB(220,220,220))?;
        canvas.copy(&texture_creator.create_texture_from_surface(&m2)?, None, Some(menu_search))?;

        // draw labels and inputs depending on mode
        match mode {
            MenuMode::Search => {
                let lbls = font.render("Search ticker:").blended(sdl2::pixels::Color::RGB(200,200,200))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&lbls)?, None, Some(sdl2::rect::Rect::new(20, 56, lbls.width(), lbls.height())))?;
                let search_text = if search_input.is_empty() { " " } else { search_input.as_str() };
                let search_surf = font.render(search_text).blended(sdl2::pixels::Color::RGB(180,220,255))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&search_surf)?, None, Some(search_box))?;
                let sbtn = font.render("Search").blended(sdl2::pixels::Color::RGB(240,240,240))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&sbtn)?, None, Some(search_button))?;
            }
            MenuMode::Login => {
                let lbl = font.render("Username:").blended(sdl2::pixels::Color::RGB(200,200,200))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&lbl)?, None, Some(sdl2::rect::Rect::new(20, 96, lbl.width(), lbl.height())))?;
                let lbl2 = font.render("Password:").blended(sdl2::pixels::Color::RGB(200,200,200))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&lbl2)?, None, Some(sdl2::rect::Rect::new(20, 156, lbl2.width(), lbl2.height())))?;
                let uname_text = if username.is_empty() { " " } else { username.as_str() };
                let uname_surf = font.render(uname_text).blended(sdl2::pixels::Color::RGB(180,220,255))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&uname_surf)?, None, Some(username_box))?;
                let pass_display = "*".repeat(password.len());
                let pass_text = if pass_display.is_empty() { " " } else { pass_display.as_str() };
                let pass_surf = font.render(pass_text).blended(sdl2::pixels::Color::RGB(180,220,255))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&pass_surf)?, None, Some(password_box))?;
                let btn = font.render("Register").blended(sdl2::pixels::Color::RGB(240,240,240))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&btn)?, None, Some(register_box))?;
                let lbtn = font.render("Login").blended(sdl2::pixels::Color::RGB(240,240,240))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&lbtn)?, None, Some(login_box))?;
            }
            MenuMode::None => {
                // show small hint
                let hint = font.render("Select Login or Search from the menu above").blended(sdl2::pixels::Color::RGB(150,150,150))?;
                canvas.copy(&texture_creator.create_texture_from_surface(&hint)?, None, Some(sdl2::rect::Rect::new(20, 100, hint.width(), hint.height())))?;
            }
        }

        // status
        let st = status.lock().unwrap().clone();
        let st_text = if st.is_empty() { " " } else { st.as_str() };
        let st_surf = font.render(st_text).blended(sdl2::pixels::Color::RGB(200,200,120))?;
        canvas.copy(&texture_creator.create_texture_from_surface(&st_surf)?, None, Some(sdl2::rect::Rect::new(20, 420, st_surf.width(), st_surf.height())))?;

        canvas.present();
        std::thread::sleep(std::time::Duration::from_millis(16));
    }

    Ok(())
}
