// Multithreaded example: spawns N threads that produce messages
#include <thread>
#include <vector>
#include <string>
#include <iostream>
#include <cstdlib>

int main(int argc, char** argv) {
    int n = 4;
    if (argc >= 2) n = std::atoi(argv[1]);
    if (n <= 0) return 2;

    std::vector<std::string> results(n);
    std::vector<std::thread> threads;
    threads.reserve(n);

    for (int i = 0; i < n; ++i) {
        threads.emplace_back([i, &results]() {
            results[i] = "Hello from thread " + std::to_string(i) + "!";
        });
    }

    for (auto &t : threads) t.join();

    for (int i = 0; i < n; ++i) {
        std::cout << results[i] << std::endl;
    }

    return 0;
}
