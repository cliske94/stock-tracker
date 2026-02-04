#include "http_client.h"
#include <curl/curl.h>
#include <stdexcept>

static size_t write_cb(void *ptr, size_t size, size_t nmemb, void *userdata) {
    std::string *s = static_cast<std::string*>(userdata);
    s->append(static_cast<char*>(ptr), size * nmemb);
    return size * nmemb;
}

std::string http_get(const std::string &url) {
    CURL *c = curl_easy_init();
    if (!c) throw std::runtime_error("curl_easy_init failed");
    std::string out;
    curl_easy_setopt(c, CURLOPT_URL, url.c_str());
    curl_easy_setopt(c, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(c, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(c, CURLOPT_WRITEDATA, &out);
    CURLcode res = curl_easy_perform(c);
    long code = 0;
    curl_easy_getinfo(c, CURLINFO_RESPONSE_CODE, &code);
    curl_easy_cleanup(c);
    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("curl failed: ") + curl_easy_strerror(res));
    }
    if (code >= 400) {
        throw std::runtime_error(std::string("HTTP error: ") + std::to_string(code));
    }
    return out;
}

std::string http_get_auth(const std::string &url, const std::string &token) {
    CURL *c = curl_easy_init();
    if (!c) throw std::runtime_error("curl_easy_init failed");
    std::string out;
    struct curl_slist *headers = nullptr;
    std::string auth = std::string("Authorization: Bearer ") + token;
    headers = curl_slist_append(headers, auth.c_str());
    curl_easy_setopt(c, CURLOPT_URL, url.c_str());
    curl_easy_setopt(c, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(c, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(c, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(c, CURLOPT_WRITEDATA, &out);
    CURLcode res = curl_easy_perform(c);
    long code = 0;
    curl_easy_getinfo(c, CURLINFO_RESPONSE_CODE, &code);
    curl_slist_free_all(headers);
    curl_easy_cleanup(c);
    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("curl failed: ") + curl_easy_strerror(res));
    }
    if (code >= 400) {
        throw std::runtime_error(std::string("HTTP error: ") + std::to_string(code));
    }
    return out;
}

std::string http_post_json(const std::string &url, const std::string &jsonBody) {
    CURL *c = curl_easy_init();
    if (!c) throw std::runtime_error("curl_easy_init failed");
    std::string out;
    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(c, CURLOPT_URL, url.c_str());
    curl_easy_setopt(c, CURLOPT_POST, 1L);
    curl_easy_setopt(c, CURLOPT_POSTFIELDS, jsonBody.c_str());
    curl_easy_setopt(c, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(c, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(c, CURLOPT_WRITEDATA, &out);
    CURLcode res = curl_easy_perform(c);
    long code = 0;
    curl_easy_getinfo(c, CURLINFO_RESPONSE_CODE, &code);
    curl_slist_free_all(headers);
    curl_easy_cleanup(c);
    if (res != CURLE_OK) {
        throw std::runtime_error(std::string("curl failed: ") + curl_easy_strerror(res));
    }
    if (code >= 400) {
        throw std::runtime_error(std::string("HTTP error: ") + std::to_string(code));
    }
    return out;
}

    std::string http_post_json_auth(const std::string &url, const std::string &json, const std::string &token) {
        CURL *curl = curl_easy_init();
        if(!curl) throw std::runtime_error("curl_easy_init failed");
        std::string response;
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        std::string auth = std::string("Authorization: Bearer ") + token;
        headers = curl_slist_append(headers, auth.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
        CURLcode res = curl_easy_perform(curl);
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        if(res != CURLE_OK) {
            throw std::runtime_error(std::string("curl failed: ") + curl_easy_strerror(res));
        }
        return response;
    }
