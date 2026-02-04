# HelloWorld C++ Example

Simple command-line C++ program that prints "Hello, World!".

Build and run (Linux):

```bash
g++ HelloWorld.cpp -o hello
./hello
```
**Frontend & Backend Usage**

- **Rust GUI (SDL2)**: Build and run the Rust SDL2 frontend.
	- **Build:** `cd rust_hello_world && cargo build --release`
	- **Run:** `BACKEND_URL=http://localhost:8080 ./target/release/rust_hello_world`
	- **Notes:** Install system packages `libsdl2-dev` and `libsdl2-ttf-dev` on Linux and ensure a TTF font is available (the app uses DejaVuSans by default). The GUI stores a token in `token.txt` when you login/register.

- **C++ clients / examples**: Several C++ examples and clients are in the repo.
	- Quick run (examples): `g++ HelloWorld.cpp -o hello && ./hello`
	- `cpp_stock_ui` has its own `Makefile`: `cd cpp_stock_ui && make && ./cpp_stock_ui`
	- Or use the top-level CMake workflow for bundled targets:
		- `cmake -S . -B build`
		- `cmake --build build --parallel`

- **Java Backend (Spring Boot)**: Build and run the backend that exposes auth and stock endpoints.
	- **Prepare DB directory:** `mkdir -p spring_hello_world/data`
	- **Build:** `cd spring_hello_world && ./gradlew clean build`
	- **Run (dev):** `cd spring_hello_world && ./gradlew bootRun` (or `./gradlew run` if configured)
	- **API endpoints:**
		- `POST /auth/register` — JSON `{ "username":"<u>", "password":"<p>" }` returns `{ "token":"..." }` on success.
		- `POST /auth/login` — same payload, returns `{ "token":"..." }`.
		- `GET /search?ticker=<sym>` — requires header `Authorization: Bearer <token>`, returns stock JSON.
		- `GET /stock?ticker=<sym>` — similar; `POST /watchlist?ticker=<sym>` to add.
	- **Notes:** The backend uses an embedded SQLite DB at `spring_hello_world/data/stocks.db` and the included Gradle wrapper — no external DB required.

- **Integration**: Set `BACKEND_URL` for frontends (examples above use `http://localhost:8080`). Example curl test for register:

```bash
curl -i -X POST http://localhost:8080/auth/register -H 'Content-Type: application/json' -d '{"username":"test","password":"pass"}'
```

If you want, I can also add a short troubleshooting section (SDL2 deps, Java versions, or common errors).

**Troubleshooting**

- SDL2 / TTF errors
	- On Linux install system headers: `sudo apt-get install libsdl2-dev libsdl2-ttf-dev`.
	- Ensure a TTF font exists at `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` or edit `rust_hello_world/src/main.rs` to point to another font file.
	- If you see `Text has zero width` from SDL2_ttf, ensure strings passed to `font.render()` are not empty (the Rust GUI includes a guard that renders a single space for empty fields).

- Java / Gradle
	- Use the included Gradle wrapper in `spring_hello_world`: `cd spring_hello_world && ./gradlew build`.
	- If `./gradlew` fails due to permissions: `chmod +x spring_hello_world/gradlew`.
	- Check your Java version with `java -version` (project was tested with modern JDKs; Java 17+ recommended).

- Backend connectivity
	- Frontends default to `BACKEND_URL=http://host.docker.internal:8080`. On Linux hosts run the backend locally and use `http://localhost:8080` instead.
	- Quick health check: `curl -i http://localhost:8080/`.

- Common issues
	- If the Rust GUI can't connect to the backend, set `BACKEND_URL` explicitly when launching the GUI.
	- If endpoints return empty JSON or unexpected responses, check backend logs and `AuthController`/`StockController` for missing return payloads.

If you'd like, I can also add example commands for packaging into Docker images or add a short troubleshooting script.

Requires a C++ compiler such as `g++`.

Or use the included Makefile:

```bash
make
./hello
# or
make run

make clean
```

Examples
-
An additional example that accepts a name argument is available at `examples/HelloArgs.cpp`.

Build and run the example:

```bash
g++ examples/HelloArgs.cpp -o hello_args
./hello_args        # prints 'Hello, World!'
./hello_args Alice  # prints 'Hello, Alice!'
```

Tests
-
A simple test script compiles the examples and verifies their output. Run:

```bash
chmod +x tests/test_all.sh
./tests/test_all.sh
```

Qt example
-
An optional Qt-based GUI example is available at `examples/HelloQt.cpp`. It will be built by CMake only if Qt (Qt6 or Qt5) is installed on your system.

To install Qt development packages on Ubuntu and build the Qt example:

```bash
# for Qt6 (preferred if available)
sudo apt-get install -y libqt6-dev qt6-base-dev
# or for Qt5
sudo apt-get install -y qtbase5-dev

cmake -S . -B build
cmake --build build --parallel
./build/hello_qt
```

If `hello_qt` isn't produced by CMake, install one of the packages above and re-run CMake.

Multithreaded example
-
A deterministic multithreaded example is available at `examples/HelloThreads.cpp`. It spawns N threads (default 4) and prints a per-thread message in thread-index order.

Run it directly with g++:

```bash
g++ examples/HelloThreads.cpp -o hello_threads -pthread
./hello_threads        # prints 4-thread output
./hello_threads 8      # prints 8-thread output
```

Concurrency tests & benchmark
-
Unit tests that exercise concurrency are available (built with GoogleTest). After configuring with CMake, run:

```bash
cmake -S . -B build
cmake --build build --parallel
ctest --test-dir build --verbose
```

A simple benchmark comparing single-threaded vs multi-threaded summation is at `benchmarks/thread_bench.cpp`. Build it with CMake and run:

```bash
# build target is created in the CMake build directory
./build/bench_threads 4 1000000  # 4 threads, N=1_000_000
```

Docker
-
A tiny multi-stage Dockerfile builds the `hello` binary on Ubuntu and packages it into an Ubuntu runtime image. Use docker-compose to build and run the container:

```bash
# Build & run with docker-compose
docker compose build
docker compose up --remove-orphans --no-color

# The container will print 'Hello, World!' and exit.
```

If you want to keep the container running for debugging, edit `docker-compose.yml` and uncomment the `command:` override to `sleep infinity`.




