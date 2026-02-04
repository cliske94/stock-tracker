#include "watchlist.h"
#include <fstream>
#include <algorithm>

Watchlist::Watchlist(const std::string &path): path_(path) {
    load();
}

void Watchlist::load() {
    items_.clear();
    std::ifstream in(path_);
    if (!in) return;
    std::string line;
    while (std::getline(in, line)) {
        if (!line.empty()) items_.push_back(line);
    }
}

void Watchlist::save() const {
    std::ofstream out(path_);
    for (const auto &s: items_) out << s << '\n';
}

bool Watchlist::add(const std::string &ticker) {
    auto t = ticker;
    // normalize uppercase
    for (auto &c: t) c = toupper((unsigned char)c);
    if (std::find(items_.begin(), items_.end(), t) != items_.end()) return false;
    items_.push_back(t);
    save();
    return true;
}

bool Watchlist::remove(const std::string &ticker) {
    auto t = ticker;
    for (auto &c: t) c = toupper((unsigned char)c);
    auto it = std::find(items_.begin(), items_.end(), t);
    if (it == items_.end()) return false;
    items_.erase(it);
    save();
    return true;
}

std::vector<std::string> Watchlist::all() const {
    return items_;
}
