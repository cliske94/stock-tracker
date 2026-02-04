#include "../include/greetings.hpp"
#include <gtest/gtest.h>
#include <thread>
#include <vector>
#include <atomic>

TEST(ConcurrencyTest, ConcurrentSum) {
    const int threads = 8;
    const int iterations = 10000;
    std::atomic<int> failures{0};
    std::vector<std::thread> th;
    th.reserve(threads);

    for (int t = 0; t < threads; ++t) {
        th.emplace_back([&]() {
            for (int i = 0; i < iterations; ++i) {
                int a = i;
                int b = iterations - i;
                int expected = a + b;
                if (greetings::sum(a, b) != expected) ++failures;
            }
        });
    }
    for (auto &t : th) t.join();
    EXPECT_EQ(failures.load(), 0);
}

TEST(ConcurrencyTest, ConcurrentHello) {
    const int threads = 8;
    std::vector<std::string> outs(threads);
    std::vector<std::thread> th;
    th.reserve(threads);
    for (int i = 0; i < threads; ++i) {
        th.emplace_back([i, &outs]() {
            outs[i] = greetings::hello("Tester");
        });
    }
    for (auto &t : th) t.join();
    for (int i = 0; i < threads; ++i) EXPECT_EQ(outs[i], "Hello, Tester!");
}
