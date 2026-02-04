#include "../include/greetings.hpp"
#include <sstream>

namespace greetings {

std::string hello(const std::string& name) {
    return "Hello, " + name + "!";
}

int sum(int a, int b) {
    return a + b;
}

} // namespace greetings
