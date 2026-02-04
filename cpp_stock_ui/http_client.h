#pragma once
#include <string>

// Simple HTTP GET using libcurl. Returns response body string.
std::string http_get(const std::string &url);

// HTTP GET with Authorization Bearer token
std::string http_get_auth(const std::string &url, const std::string &token);

// HTTP POST with JSON body; returns response body
std::string http_post_json(const std::string &url, const std::string &jsonBody);

// HTTP POST with JSON and Authorization Bearer token
std::string http_post_json_auth(const std::string &url, const std::string &jsonBody, const std::string &token);
