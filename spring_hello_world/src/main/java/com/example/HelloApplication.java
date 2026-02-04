package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@SpringBootApplication
public class HelloApplication {
    public static void main(String[] args) {
        SpringApplication.run(HelloApplication.class, args);
    }

    @RestController
    public static class StocksController {
        private static final String API_URL = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10&exchange=NASDAQ";

        @GetMapping("/")
        public String index() {
            try {
                HttpClient client = HttpClient.newBuilder().build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(API_URL))
                        .header("Accept", "application/json, text/plain, */*")
                        .header("Referer", "https://www.nasdaq.com/")
                        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64)")
                        .GET()
                        .build();
                HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                String body = resp.body();

                ObjectMapper mapper = new ObjectMapper();
                JsonNode root = mapper.readTree(body);
                JsonNode rows = root.path("data").path("table").path("rows");

                StringBuilder sb = new StringBuilder();
                sb.append("<html><head><meta charset=\"utf-8\"><title>Top 5 NASDAQ</title></head><body>");
                sb.append("<h1>Top 5 NASDAQ</h1>");
                if (rows.isArray() && rows.size() > 0) {
                    sb.append("<ol>");
                    int n = Math.min(5, rows.size());
                    for (int i = 0; i < n; ++i) {
                        JsonNode r = rows.get(i);
                        String symbol = r.path("symbol").asText("(no-symbol)");
                        String lastsale = r.path("lastsale").asText("(no-price)");
                        sb.append("<li>").append(symbol).append(" — ").append(lastsale).append("</li>");
                    }
                    sb.append("</ol>");
                } else {
                    sb.append("<p>No data available</p>");
                }
                sb.append("</body>");
                sb.append("<script>");
                sb.append("async function searchTicker(){var q=document.getElementById('q').value; if(!q) return; let res=document.getElementById('result'); res.innerText='Searching...'; try{let r=await fetch('/search?ticker='+encodeURIComponent(q)); if(!r.ok){res.innerText='Search failed: '+r.status; return;} let j=await r.json(); res.innerText=JSON.stringify(j); }catch(e){res.innerText='Error:'+e.message;} }");
                sb.append("</script>");
                sb.append("<div style='margin-top:16px;'><input id='q' placeholder='Ticker'/> <button onclick=searchTicker()>Search</button><pre id='result'></pre></div>");
                sb.append("</html>");
                return sb.toString();
            } catch (Exception e) {
                return "<html><body><h1>Error</h1><pre>" + e.getMessage() + "</pre></body></html>";
            }
        }
    }
}
