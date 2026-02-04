// Hello world GUI: fetch top 5 US gainers and display tickers+prices using SDL2 + TTF

#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <curl/curl.h>

#include <iostream>
#include <string>
#include <vector>
#include <regex>
#include <thread>
#include <mutex>
#include <sstream>
#include <chrono>
#include <future>
#include <cstdlib>
#include <fstream>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>

static size_t write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
	size_t real_size = size * nmemb;
	std::string* s = static_cast<std::string*>(userp);
	s->append(static_cast<char*>(contents), real_size);
	return real_size;
}

// Minimal dotenv loader: reads lines of the form KEY=VALUE and calls setenv
static void load_dotenv(const std::string& path) {
	std::ifstream f(path);
	if (!f.is_open()) return;
	std::string line;
	while (std::getline(f, line)) {
		// trim leading/trailing whitespace
		auto l = line.find_first_not_of(" \t\r\n");
		if (l == std::string::npos) continue;
		if (line[l] == '#') continue;
		auto r = line.find_last_not_of(" \t\r\n");
		std::string s = line.substr(l, r - l + 1);
		auto eq = s.find('=');
		if (eq == std::string::npos) continue;
		std::string key = s.substr(0, eq);
		std::string val = s.substr(eq + 1);
		// trim key and val
		auto k1 = key.find_first_not_of(" \t");
		auto k2 = key.find_last_not_of(" \t");
		if (k1 == std::string::npos) continue;
		key = key.substr(k1, k2 - k1 + 1);
		auto v1 = val.find_first_not_of(" \t");
		if (v1 == std::string::npos) val.clear(); else {
			auto v2 = val.find_last_not_of(" \t");
			val = val.substr(v1, v2 - v1 + 1);
		}
		// strip surrounding quotes if present
		if (val.size() >= 2 && ((val.front() == '"' && val.back() == '"') || (val.front() == '\'' && val.back() == '\''))) {
			val = val.substr(1, val.size()-2);
		}
		// only set if not already set
		if (getenv(key.c_str()) == NULL) setenv(key.c_str(), val.c_str(), 1);
	}
}

// Fetches JSON from Nasdaq screener API (public endpoint). Uses a browser UA to avoid blocking.
static bool fetch_screener_json(std::string& out) {
	const std::string url = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10&exchange=NASDAQ";
	CURL* curl = curl_easy_init();
	if (!curl) return false;
	struct curl_slist* headers = nullptr;
	headers = curl_slist_append(headers, "Accept: application/json, text/plain, */*");
	headers = curl_slist_append(headers, "Referer: https://www.nasdaq.com/");
	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
	curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &out);
	curl_easy_setopt(curl, CURLOPT_USERAGENT, "Mozilla/5.0 (X11; Linux x86_64)");
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
	CURLcode res = curl_easy_perform(curl);
	if (res != CURLE_OK) {
		(void)res; // leave error handling in place but do not write debug file
	}
	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);
	return (res == CURLE_OK);
}

static std::string url_encode(const std::string &s) {
	std::ostringstream o;
	const char* hex = "0123456789ABCDEF";
	for (unsigned char c : s) {
		if (isalnum(c) || c=='-'||c=='_'||c=='.'||c=='~') o<<c;
		else {
			o<<'%'; o<<hex[c>>4]; o<<hex[c&15];
		}
	}
	return o.str();
}

// Cross-platform: open system browser to URL. Uses $BROWSER if set, falls back to
// xdg-open on Linux, open on macOS, and start on Windows.
static void open_browser(const std::string& url) {
#if defined(_WIN32)
	std::string cmd = std::string("cmd /C start \"") + "\"\" \"" + url + "\"";
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-result"
#endif
	system(cmd.c_str());
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
#elif defined(__APPLE__)
	std::string cmd = std::string("open ") + "\"" + url + "\"";
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-result"
#endif
	system(cmd.c_str());
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
#else
	// POSIX: fork and exec common browser/open commands to avoid shell quoting issues.
	pid_t pid = fork();
	if (pid == -1) {
		return;
	}
	if (pid == 0) {
		// child
		const char* browser_env = getenv("BROWSER");
		if (browser_env && browser_env[0]) {
			execlp(browser_env, browser_env, url.c_str(), (char*)NULL);
		}
		const char* candidates[] = {"xdg-open", "gio", "gnome-open", "firefox", "google-chrome", "chromium", "chromium-browser", NULL};
		for (const char** c = candidates; *c != NULL; ++c) {
			if (strcmp(*c, "gio") == 0) {
				execlp("gio", "gio", "open", url.c_str(), (char*)NULL);
			} else {
				execlp(*c, *c, url.c_str(), (char*)NULL);
			}
		}
		_exit(127);
	}
	// parent: do not wait for child; it will launch browser asynchronously
#endif
}

// Start a simple local HTTP server that waits for one callback and extracts `code` param.
static bool wait_for_oauth_code(int port, std::string& out_code, int timeout_seconds=120) {
	int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
	if (listen_fd < 0) return false;
	int opt = 1; setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
	struct sockaddr_in addr{};
	addr.sin_family = AF_INET;
	addr.sin_addr.s_addr = inet_addr("127.0.0.1");
	addr.sin_port = htons(port);
	if (bind(listen_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
		close(listen_fd); return false;
	}
	if (listen(listen_fd, 1) < 0) { close(listen_fd); return false; }
	// set non-blocking accept with timeout using select
	fd_set fds; FD_ZERO(&fds); FD_SET(listen_fd, &fds);
	struct timeval tv{}; tv.tv_sec = timeout_seconds; tv.tv_usec = 0;
	int sel = select(listen_fd+1, &fds, NULL, NULL, &tv);
	if (sel <= 0) { close(listen_fd); return false; }
	int conn = accept(listen_fd, NULL, NULL);
	if (conn < 0) { close(listen_fd); return false; }
	// read request
	std::string req;
	char buf[4096];
	ssize_t n = read(conn, buf, sizeof(buf)-1);
	if (n>0) { buf[n]=0; req.assign(buf, n); }
	// find GET line and extract ?... part
	std::string::size_type p = req.find("GET ");
	std::string code;
	if (p!=std::string::npos) {
		auto q = req.find(" ", p+4);
		if (q!=std::string::npos) {
			std::string path = req.substr(p+4, q-(p+4));
			auto qm = path.find('?');
			if (qm!=std::string::npos) {
				std::string qs = path.substr(qm+1);
				// find code=
				auto cpos = qs.find("code=");
				if (cpos!=std::string::npos) {
					auto amp = qs.find('&', cpos);
					code = qs.substr(cpos+5, (amp==std::string::npos? qs.size(): amp)-(cpos+5));
				}
			}
		}
	}
	// respond with simple page
	std::string resp;
	if (!code.empty()) {
		resp = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body><h1>Authentication complete</h1><p>You can close this window and return to the app.</p></body></html>";
		out_code = code;
	} else {
		resp = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><body><h1>Missing code</h1></body></html>";
	}
#if defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-result"
#endif
	write(conn, resp.c_str(), resp.size());
#if defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
	close(conn);
	close(listen_fd);
	return !code.empty();
}

static bool exchange_code_for_token(const std::string& provider, const std::string& client_id, const std::string& client_secret, const std::string& code, const std::string& redirect_uri, std::string& out_token, std::string& out_error) {
	std::string post;
	std::string url;
	struct curl_slist* headers = nullptr;
	if (provider=="github") {
		url = "https://github.com/login/oauth/access_token";
		post = "client_id="+url_encode(client_id)+"&client_secret="+url_encode(client_secret)+"&code="+url_encode(code)+"&redirect_uri="+url_encode(redirect_uri);
		headers = curl_slist_append(headers, "Accept: application/json");
	} else if (provider=="google") {
		url = "https://oauth2.googleapis.com/token";
		post = "code="+url_encode(code)+"&client_id="+url_encode(client_id)+"&client_secret="+url_encode(client_secret)+"&redirect_uri="+url_encode(redirect_uri)+"&grant_type=authorization_code";
		headers = curl_slist_append(headers, "Content-Type: application/x-www-form-urlencoded");
		headers = curl_slist_append(headers, "Accept: application/json");
	} else {
		out_error = "unsupported provider"; return false;
	}

	CURL* curl = curl_easy_init(); if (!curl) { out_error = "curl init failed"; return false; }
	std::string resp;
	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
	curl_easy_setopt(curl, CURLOPT_POSTFIELDS, post.c_str());
	curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)post.size());
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp);
	if (headers) curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	curl_easy_setopt(curl, CURLOPT_USERAGENT, "Mozilla/5.0 (X11; Linux x86_64)");
	CURLcode res = curl_easy_perform(curl);
	if (headers) curl_slist_free_all(headers);
	curl_easy_cleanup(curl);
	if (res != CURLE_OK) { out_error = "network error"; return false; }

	// try to extract access_token from JSON response
	std::smatch m;
	std::regex tok_re(R"RE("access_token"\s*:\s*"([^"]+)")RE");
	if (std::regex_search(resp, m, tok_re)) {
		out_token = m[1].str();
		return true;
	}
	// fallback: some endpoints return access_token=... in body
	std::regex form_re(R"RE(access_token=([^&\n]+))RE");
	if (std::regex_search(resp, m, form_re)) {
		out_token = m[1].str();
		return true;
	}
	out_error = "token not found in response";
	return false;
}


// Very small JSON extraction: collect symbols and corresponding regularMarketPrice.raw
static std::vector<std::pair<std::string,std::string>> parse_top_gainers(const std::string& json, size_t max_items=5) {
	std::vector<std::pair<std::string,std::string>> out;
	// Nasdaq API returns rows with fields like "symbol":"NVDA","lastsale":"$178.9148"
	std::regex sym_re(R"REGEX("symbol"\s*:\s*"([A-Z0-9\.\-]+)")REGEX");
	std::regex price_re(R"REGEX("lastsale"\s*:\s*"\$?([0-9,]+\.?[0-9]*)")REGEX");
	std::sregex_iterator end;

	// Collect symbols
	std::vector<std::string> syms;
	for (std::sregex_iterator i(json.begin(), json.end(), sym_re); i != end; ++i) {
		syms.push_back((*i)[1].str());
	}

	// Collect prices
	std::vector<std::string> prices;
	for (std::sregex_iterator i(json.begin(), json.end(), price_re); i != end; ++i) {
		prices.push_back((*i)[1].str());
	}

	size_t n = std::min({max_items, syms.size(), prices.size()});
	for (size_t i = 0; i < n; ++i) {
		out.emplace_back(syms[i], prices[i]);
	}
	return out;
}

int main(int argc, char** argv) {
	if (SDL_Init(SDL_INIT_VIDEO) != 0) {
		std::cerr << "SDL_Init Error: " << SDL_GetError() << std::endl;
		return 1;
	}
	if (TTF_Init() != 0) {
		std::cerr << "TTF_Init Error: " << TTF_GetError() << std::endl;
		SDL_Quit();
		return 1;
	}

	if (curl_global_init(CURL_GLOBAL_DEFAULT) != 0) {
		std::cerr << "curl_global_init failed" << std::endl;
		TTF_Quit();
		SDL_Quit();
		return 1;
	}

	const int win_w = 640;
	const int win_h = 360;
	SDL_Window* window = SDL_CreateWindow("HelloWorld Stocks", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, win_w, win_h, SDL_WINDOW_SHOWN);
	if (!window) {
		std::cerr << "SDL_CreateWindow Error: " << SDL_GetError() << std::endl;
		curl_global_cleanup();
		TTF_Quit();
		SDL_Quit();
		return 1;
	}

	SDL_Renderer* ren = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
	if (!ren) {
		std::cerr << "SDL_CreateRenderer Error: " << SDL_GetError() << std::endl;
		SDL_DestroyWindow(window);
		curl_global_cleanup();
		TTF_Quit();
		SDL_Quit();
		return 1;
	}

	const char* font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
	TTF_Font* font = TTF_OpenFont(font_path, 20);
	if (!font) {
		std::cerr << "TTF_OpenFont Error: " << TTF_GetError() << std::endl;
		SDL_DestroyRenderer(ren);
		SDL_DestroyWindow(window);
		curl_global_cleanup();
		TTF_Quit();
		SDL_Quit();
		return 1;
	}

	std::mutex data_mtx;
	std::vector<std::pair<std::string,std::string>> stocks;
	bool fetching = false;
	std::string status_message;
	bool running = true;

	// OAuth state
	bool authenticated = false;
	std::string access_token;
	std::string provider = "github";

	// load local .env if present (allows OAUTH_CLIENT_ID/SECRET to be stored locally)
	// try current dir, then parent directory so running from `build/` still finds .env
	load_dotenv(".env");
	if (!getenv("OAUTH_CLIENT_ID") || !getenv("OAUTH_CLIENT_SECRET")) {
		load_dotenv("../.env");
	}

	// do not write environment debug files in production
	if (const char* p = getenv("OAUTH_PROVIDER")) provider = p;
	std::string client_id;
	std::string client_secret;
	if (const char* v = getenv("OAUTH_CLIENT_ID")) client_id = v;
	if (const char* v2 = getenv("OAUTH_CLIENT_SECRET")) client_secret = v2;

	// Background fetch function
	auto do_fetch = [&]() {
		std::string json;
		{
			std::lock_guard<std::mutex> lock(data_mtx);
			fetching = true;
		}
		bool ok = fetch_screener_json(json);
		std::vector<std::pair<std::string,std::string>> parsed;
		std::string local_status;
		if (ok) {
			if (json.find("Too Many Requests") != std::string::npos || json.find("Edge: Too Many Requests") != std::string::npos) {
				local_status = "Rate limited by provider (Too Many Requests).";
			} else {
				parsed = parse_top_gainers(json, 5);
				if (parsed.empty()) local_status = "No parseable data in response.";
			}
		} else {
			local_status = "Network fetch failed.";
		}
		{
			std::lock_guard<std::mutex> lock(data_mtx);
			// Only replace stocks when we have new parsed data; otherwise keep previous data visible.
			if (ok && !parsed.empty()) {
				stocks = std::move(parsed);
				status_message.clear();
			} else {
				// keep existing `stocks` if present and report status
				status_message = local_status;
			}
			fetching = false;
		}
	};

	// We require authentication before fetching. Show prompt until authenticated.

	SDL_Event e;
	while (running) {
		while (SDL_PollEvent(&e)) {
			if (e.type == SDL_QUIT) running = false;
			if (e.type == SDL_KEYDOWN) {
				if (e.key.keysym.sym == SDLK_ESCAPE) running = false;
				if (e.key.keysym.sym == SDLK_r) {
					// refresh (only if authenticated)
					if (authenticated) std::thread(do_fetch).detach();
					else status_message = "Please login first (press 'l').";
				}

				if (e.key.keysym.sym == SDLK_l) {
					if (authenticated) { status_message = "Already authenticated."; }
					else {
						// start OAuth flow in background
						std::thread([&]() {
							int port = 54321;
							std::string redirect = std::string("http://127.0.0.1:") + std::to_string(port) + "/callback";
							if (client_id.empty() || client_secret.empty()) {
								std::lock_guard<std::mutex> lock(data_mtx);
								status_message = "Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables.";
								return;
							}
							std::string auth_url;
							if (provider=="github") {
								auth_url = "https://github.com/login/oauth/authorize?client_id=" + url_encode(client_id) + "&redirect_uri=" + url_encode(redirect) + "&scope=read:user";
							} else {
								auth_url = "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=" + url_encode(client_id) + "&redirect_uri=" + url_encode(redirect) + "&scope=" + url_encode("openid email profile") + "&access_type=offline&prompt=consent";
							}
							{
								std::lock_guard<std::mutex> lock(data_mtx);
								status_message = "Opening browser for authentication...";
							}
							// Start listener in background first to avoid race (browser redirect arriving before bind).
							std::promise<std::string> codePromise;
							std::future<std::string> codeFuture = codePromise.get_future();
							std::thread listenerThread([port, p = std::move(codePromise)]() mutable {
								std::string code;
								bool got = wait_for_oauth_code(port, code, 120);
								if (got) p.set_value(code);
								else p.set_value(std::string());
							});
							// Open browser after listener is started
							open_browser(auth_url);
							// Wait for code (listener has its own timeout)
							std::string code = codeFuture.get();
							listenerThread.join();
							if (code.empty()) {
								std::lock_guard<std::mutex> lock(data_mtx);
								status_message = "Authentication timed out or failed to receive callback.";
								return;
							}
							std::string token;
							std::string err;
							bool ok = exchange_code_for_token(provider, client_id, client_secret, code, redirect, token, err);
							if (!ok) {
								std::lock_guard<std::mutex> lock(data_mtx);
								status_message = std::string("Token exchange failed: ") + err;
								return;
							}
							{
								std::lock_guard<std::mutex> lock(data_mtx);
								access_token = token;
								authenticated = true;
								status_message.clear();
							}
							// start initial fetch after authentication
							std::thread(do_fetch).detach();
						}).detach();
					}
				}
			}
		}

		SDL_SetRenderDrawColor(ren, 20, 20, 20, 255);
		SDL_RenderClear(ren);

		SDL_Color titleCol = {220,220,220,255};
		SDL_Color col = {200,200,255,255};

		// Render title
		SDL_Surface* sTitle = TTF_RenderUTF8_Blended(font, "Top 5 US Gainers (press r to refresh)", titleCol);
		if (sTitle) {
			SDL_Texture* tTitle = SDL_CreateTextureFromSurface(ren, sTitle);
			if (tTitle) {
				SDL_Rect dstTitle = {10, 8, sTitle->w, sTitle->h};
				SDL_RenderCopy(ren, tTitle, NULL, &dstTitle);
				SDL_DestroyTexture(tTitle);
			}
			SDL_FreeSurface(sTitle);
		}

		// Render stocks or loading message
		std::lock_guard<std::mutex> lock(data_mtx);
		if (fetching) {
			SDL_Surface* s = TTF_RenderUTF8_Blended(font, "Fetching...", col);
			if (s) {
				SDL_Texture* t = SDL_CreateTextureFromSurface(ren, s);
				if (t) {
					SDL_Rect dst = {10, 48, s->w, s->h};
					SDL_RenderCopy(ren, t, NULL, &dst);
					SDL_DestroyTexture(t);
				}
				SDL_FreeSurface(s);
			}
		} else if (!status_message.empty()) {
			SDL_Surface* s = TTF_RenderUTF8_Blended(font, status_message.c_str(), col);
			if (s) {
				SDL_Texture* t = SDL_CreateTextureFromSurface(ren, s);
				if (t) {
					SDL_Rect dst = {10, 48, s->w, s->h};
					SDL_RenderCopy(ren, t, NULL, &dst);
					SDL_DestroyTexture(t);
				}
				SDL_FreeSurface(s);
			}
		} else if (stocks.empty()) {
			SDL_Surface* s = TTF_RenderUTF8_Blended(font, "No data available (network or parse error)", col);
			if (s) {
				SDL_Texture* t = SDL_CreateTextureFromSurface(ren, s);
				if (t) {
					SDL_Rect dst = {10, 48, s->w, s->h};
					SDL_RenderCopy(ren, t, NULL, &dst);
					SDL_DestroyTexture(t);
				}
				SDL_FreeSurface(s);
			}
		} else {
			int y = 48;
			for (size_t i = 0; i < stocks.size(); ++i) {
				std::string line = std::to_string(i+1) + ". " + stocks[i].first + " — $" + stocks[i].second;
				SDL_Surface* s = TTF_RenderUTF8_Blended(font, line.c_str(), col);
				SDL_Texture* t = SDL_CreateTextureFromSurface(ren, s);
				SDL_Rect dst = {10, y, s->w, s->h};
				SDL_RenderCopy(ren, t, NULL, &dst);
				y += s->h + 8;
				SDL_FreeSurface(s);
				SDL_DestroyTexture(t);
			}
		}

		SDL_RenderPresent(ren);
		SDL_Delay(16);
	}

	TTF_CloseFont(font);
	SDL_DestroyRenderer(ren);
	SDL_DestroyWindow(window);
	curl_global_cleanup();
	TTF_Quit();
	SDL_Quit();
	return 0;
}