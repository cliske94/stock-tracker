#pragma once
#include <string>

class TokenStore {
public:
    TokenStore(const std::string &path = "token.txt");
    std::string load() const;
    void save(const std::string &token) const;
private:
    std::string path_;
};
