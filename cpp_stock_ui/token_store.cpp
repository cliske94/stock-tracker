#include "token_store.h"
#include <fstream>

TokenStore::TokenStore(const std::string &path): path_(path) {}

std::string TokenStore::load() const {
    std::ifstream in(path_);
    if (!in) return std::string();
    std::string token;
    std::getline(in, token);
    return token;
}

void TokenStore::save(const std::string &token) const {
    std::ofstream out(path_);
    if (!out) return;
    out << token << std::endl;
}
