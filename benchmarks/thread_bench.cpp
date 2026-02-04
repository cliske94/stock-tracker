#include <chrono>
#include <iostream>
#include <vector>
#include <thread>
#include <numeric>

long long range_sum(int start, int end) {
    long long s = 0;
    for (int i = start; i < end; ++i) s += i;
    return s;
}

int main(int argc, char** argv) {
    int threads = 4;
    int N = 10000000; // total items
    if (argc >= 2) threads = std::atoi(argv[1]);
    if (argc >= 3) N = std::atoi(argv[2]);

    // single-thread
    auto t0 = std::chrono::steady_clock::now();
    long long single = range_sum(0, N);
    auto t1 = std::chrono::steady_clock::now();
    std::chrono::duration<double> single_d = t1 - t0;

    // multi-thread
    int chunk = N / threads;
    std::vector<long long> parts(threads);
    auto tm0 = std::chrono::steady_clock::now();
    std::vector<std::thread> th;
    for (int i = 0; i < threads; ++i) {
        int s = i * chunk;
        int e = (i == threads-1) ? N : s + chunk;
        th.emplace_back([s,e,i,&parts]() { parts[i] = range_sum(s,e); });
    }
    for (auto &t : th) t.join();
    long long multi = std::accumulate(parts.begin(), parts.end(), 0LL);
    auto tm1 = std::chrono::steady_clock::now();
    std::chrono::duration<double> multi_d = tm1 - tm0;

    std::cout << "N=" << N << " threads=" << threads << "\n";
    std::cout << "single: " << single << " time=" << single_d.count() << "s\n";
    std::cout << "multi:  " << multi << " time=" << multi_d.count() << "s\n";
    return 0;
}
