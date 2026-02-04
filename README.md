# HelloWorld C++ Example

Simple command-line C++ program that prints "Hello, World!".

Build and run (Linux):

```bash
g++ HelloWorld.cpp -o hello
./hello
```

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




