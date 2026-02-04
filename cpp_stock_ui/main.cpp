#include <iostream>
// Qt5 GUI version of the Stock UI
#include <QApplication>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QComboBox>
#include <QTextEdit>
#include <QLabel>
#include <QListWidget>
#include <QString>
#include <filesystem>
#include <QMessageBox>

#include "http_client.h"
#include "watchlist.h"
#include "token_store.h"

static const std::string JAVA_API_BASE = "http://localhost:8080";

static QString toQString(const std::string &s) { return QString::fromStdString(s); }
static std::string toStdString(const QString &s) { return s.toStdString(); }

int main(int argc, char **argv) {
    QApplication app(argc, argv);
    QWidget window;
    window.setWindowTitle("Stock Watchlist");

    QVBoxLayout *mainLayout = new QVBoxLayout(&window);

    // Auth row
    QHBoxLayout *authRow = new QHBoxLayout();
    QLineEdit *userEdit = new QLineEdit(); userEdit->setPlaceholderText("Username");
    QLineEdit *passEdit = new QLineEdit(); passEdit->setPlaceholderText("Password"); passEdit->setEchoMode(QLineEdit::Password);
    QPushButton *loginBtn = new QPushButton("Login");
    QPushButton *regBtn = new QPushButton("Register");
    QPushButton *logoutBtn = new QPushButton("Logout");
    logoutBtn->setVisible(false);
    authRow->addWidget(new QLabel("User:")); authRow->addWidget(userEdit);
    authRow->addWidget(new QLabel("Pass:")); authRow->addWidget(passEdit);
    authRow->addWidget(loginBtn); authRow->addWidget(regBtn); authRow->addWidget(logoutBtn);
    mainLayout->addLayout(authRow);

    // Top: search/ticker input and action dropdown
    QHBoxLayout *top = new QHBoxLayout();
    QLineEdit *tickerEdit = new QLineEdit();
    tickerEdit->setPlaceholderText("Ticker (e.g. F)");
    QComboBox *actions = new QComboBox();
    actions->addItems({"Search", "Details", "Add to Watchlist", "Remove from Watchlist", "List Watchlist (with details)", "Show Raw Watchlist"});
    QPushButton *runBtn = new QPushButton("Run");
    top->addWidget(new QLabel("Ticker:"));
    top->addWidget(tickerEdit);
    top->addWidget(actions);
    top->addWidget(runBtn);
    mainLayout->addLayout(top);

    // Result area
    QTextEdit *result = new QTextEdit();
    result->setReadOnly(true);
    mainLayout->addWidget(result);

    auto showText = [&](const std::string &s){ result->append(toQString(s)); };

    Watchlist watch("watchlist.txt");
    TokenStore tstore("token.txt");
    std::string currentToken = tstore.load();
    if (!currentToken.empty()) {
        showText(std::string("Loaded saved token: ") + currentToken);
        // reflect logged-in state: make login button act as logout
        loginBtn->setText("Logout");
        regBtn->setVisible(false);
        logoutBtn->setVisible(false);
    }

    QObject::connect(loginBtn, &QPushButton::clicked, [&](){
        result->clear();
        // if already logged in, perform logout
        if (!currentToken.empty()) {
            // confirm
            QMessageBox::StandardButton reply = QMessageBox::question(&window, "Logout", "Are you sure you want to logout?", QMessageBox::Yes|QMessageBox::No);
            if (reply != QMessageBox::Yes) return;
            try {
                // call server logout endpoint
                http_post_json_auth(std::string(JAVA_API_BASE) + "/auth/logout", std::string("{}"), currentToken);
            } catch (...) {}
            currentToken.clear();
            try { std::filesystem::remove("token.txt"); } catch(...) {}
            tstore.save(std::string());
            showText("Logged out");
            loginBtn->setText("Login");
            regBtn->setVisible(true);
            // ensure logoutBtn hidden if present
            logoutBtn->setVisible(false);
            return;
        }
        // perform login
        QString user = userEdit->text().trimmed();
        QString pass = passEdit->text();
        if (user.isEmpty() || pass.isEmpty()) { showText("Enter username and password"); return; }
        std::string url = JAVA_API_BASE + std::string("/auth/login");
        std::string payload = std::string("{\"username\":\"") + toStdString(user) + "\",\"password\":\"" + toStdString(pass) + "\"}";
        try {
            auto resp = http_post_json(url, payload);
            // naive parse for token
            auto pos = resp.find("\"token\"");
            if (pos != std::string::npos) {
                auto colon = resp.find(':', pos);
                auto q1 = resp.find('"', colon);
                auto q2 = resp.find('"', q1+1);
                if (q1!=std::string::npos && q2!=std::string::npos && q2>q1) {
                    currentToken = resp.substr(q1+1, q2-q1-1);
                    tstore.save(currentToken);
                    showText(std::string("Logged in, token=") + currentToken);
                    // update UI: change login button into logout
                    loginBtn->setText("Logout");
                    regBtn->setVisible(false);
                    logoutBtn->setVisible(false);
                    return;
                }
            }
            showText(std::string("Login response: ") + resp);
        } catch (const std::exception &e) { showText(std::string("Login error: ") + e.what()); }
    });

    QObject::connect(regBtn, &QPushButton::clicked, [&](){
        result->clear();
        QString user = userEdit->text().trimmed();
        QString pass = passEdit->text();
        if (user.isEmpty() || pass.isEmpty()) { showText("Enter username and password"); return; }
        std::string url = JAVA_API_BASE + std::string("/auth/register");
        std::string payload = std::string("{\"username\":\"") + toStdString(user) + "\",\"password\":\"" + toStdString(pass) + "\"}";
        try {
            auto resp = http_post_json(url, payload);
            auto pos = resp.find("\"token\"");
            if (pos != std::string::npos) {
                auto colon = resp.find(':', pos);
                auto q1 = resp.find('"', colon);
                auto q2 = resp.find('"', q1+1);
                if (q1!=std::string::npos && q2!=std::string::npos && q2>q1) {
                    currentToken = resp.substr(q1+1, q2-q1-1);
                    tstore.save(currentToken);
                    showText(std::string("Registered, token=") + currentToken);
                    // update UI: make login button act as logout
                    loginBtn->setText("Logout");
                    regBtn->setVisible(false);
                    logoutBtn->setVisible(false);
                    return;
                }
            }
            showText(std::string("Register response: ") + resp);
        } catch (const std::exception &e) { showText(std::string("Register error: ") + e.what()); }
    });

    QObject::connect(runBtn, &QPushButton::clicked, [&](){
        QString action = actions->currentText();
        QString tick = tickerEdit->text().trimmed();
        result->clear();
        if (action == "Search") {
            if (tick.isEmpty()) { showText("Please enter a ticker."); return; }
            std::string url = JAVA_API_BASE + "/search?ticker=" + toStdString(tick);
            try {
                auto resp = currentToken.empty() ? http_get(url) : http_get_auth(url, currentToken);
                showText(resp);
            } catch (const std::exception &e) {
                showText(std::string("Error: ") + e.what());
            }
        } else if (action == "Details") {
            if (tick.isEmpty()) { showText("Please enter a ticker."); return; }
            std::string url = JAVA_API_BASE + "/stock?ticker=" + toStdString(tick);
            try {
                auto resp = currentToken.empty() ? http_get(url) : http_get_auth(url, currentToken);
                showText(resp);
            } catch (const std::exception &e) {
                showText(std::string("Error: ") + e.what());
            }
        } else if (action == "Add to Watchlist") {
            if (tick.isEmpty()) { showText("Please enter a ticker."); return; }
            if (currentToken.empty()) { showText("Login required to modify watchlist"); return; }
            std::string url = JAVA_API_BASE + "/watchlist?ticker=" + toStdString(tick);
            try {
                std::string resp = http_post_json_auth(url, std::string("{}"), currentToken);
                showText(resp);
            } catch (const std::exception &e) { showText(std::string("Error: ") + e.what()); }
        } else if (action == "Remove from Watchlist") {
            if (tick.isEmpty()) { showText("Please enter a ticker."); return; }
            if (currentToken.empty()) { showText("Login required to modify watchlist"); return; }
            std::string url = JAVA_API_BASE + "/watchlist?ticker=" + toStdString(tick);
            try {
                std::string resp = http_post_json_auth(url, std::string("{}"), currentToken);
                showText(resp);
            } catch (const std::exception &e) { showText(std::string("Error: ") + e.what()); }
        } else if (action == "List Watchlist (with details)") {
            if (currentToken.empty()) {
                auto items = watch.all();
                if (items.empty()) { showText("Watchlist is empty."); return; }
                for (auto &t : items) {
                    showText(std::string("--- ") + t + " ---");
                    std::string url = JAVA_API_BASE + "/stock?ticker=" + t;
                    try {
                        auto resp = http_get(url);
                        showText(resp);
                    } catch (const std::exception &e) {
                        showText(std::string("Error fetching ") + t + ": " + e.what());
                    }
                }
            } else {
                try {
                    std::string resp = http_get_auth(JAVA_API_BASE + "/watchlist", currentToken);
                    showText(resp);
                } catch (const std::exception &e) {
                    showText(std::string("Error: ") + e.what());
                }
            }
        } else if (action == "Show Raw Watchlist") {
            if (currentToken.empty()) {
                auto items = watch.all();
                if (items.empty()) { showText("Watchlist is empty."); return; }
                for (auto &t : items) showText(t);
            } else {
                try {
                    std::string resp = http_get_auth(JAVA_API_BASE + "/watchlist", currentToken);
                    showText(resp);
                } catch (const std::exception &e) {
                    showText(std::string("Error: ") + e.what());
                }
            }
        }
    });

    // logout handled via login button toggle; hide extra logout button
    logoutBtn->setVisible(false);

    window.resize(800, 600);
    window.show();
    return app.exec();
}
