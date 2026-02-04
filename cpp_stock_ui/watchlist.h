#pragma once
#include <string>
#include <vector>

class Watchlist {
public:
    Watchlist(const std::string &path = "watchlist.txt");
    void load();
    void save() const;
    bool add(const std::string &ticker);
    bool remove(const std::string &ticker);
    std::vector<std::string> all() const;
private:
    std::string path_;
    std::vector<std::string> items_;
};
