// Example: prints Hello, <name>! using the greetings library
#include <iostream>
#include <string>
#include "../include/greetings.hpp"

int main(int argc, char** argv) {
    std::string name = "World";
    if (argc >= 2) name = argv[1];
    std::cout << greetings::hello(name) << std::endl;
    return 0;
}
