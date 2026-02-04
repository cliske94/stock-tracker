// Example: sums two integers passed as arguments
#include <iostream>
#include <cstdlib>
#include "../include/greetings.hpp"

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Usage: " << argv[0] << " <a> <b>\n";
        return 2;
    }
    int a = std::atoi(argv[1]);
    int b = std::atoi(argv[2]);
    std::cout << greetings::sum(a, b) << std::endl;
    return 0;
}
