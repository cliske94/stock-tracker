package com.example.service;

import com.example.entity.StockEntity;
import com.example.repository.StockRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.Locale;

@Service
public class StockService {
    private static final Logger log = LoggerFactory.getLogger(StockService.class);
    private final StockRepository repo;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    public StockService(StockRepository repo) {
        this.repo = repo;
    }

    public StockEntity getStock(String ticker) {
        if (ticker == null || ticker.isBlank()) return null;
        String up = ticker.toUpperCase();
        return repo.findById(up).orElseGet(() -> fetchAndSave(up));
    }

    private StockEntity fetchAndSave(String ticker) {
        Double price = fetchPriceWithRetries(ticker, 3, 500);
        if (price == null) return null;
        StockEntity e = new StockEntity(ticker, price, Instant.now().toEpochMilli());
        repo.save(e);
        return e;
    }

    private Double fetchPriceWithRetries(String ticker, int maxAttempts, long initialDelayMs) {
        long delay = initialDelayMs;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Double p = fetchPriceFromApi(ticker);
                if (p != null) return p;
            } catch (Exception ex) {
                log.warn("Attempt {} fetch failed for {}: {}", attempt, ticker, ex.getMessage());
            }
            try { Thread.sleep(delay); } catch (InterruptedException ignored) {}
            delay *= 2;
        }
        return null;
    }

    private Double fetchPriceFromApi(String ticker) {
        try {
            // Use Stooq free CSV endpoint (no API key required) to avoid Yahoo restrictions.
            // Example: https://stooq.com/q/l/?s=f.us&f=sd2t2ohlcv&h&e=csv
            String sym = ticker.toLowerCase(Locale.ROOT);
            String querySymbol = sym.endsWith(".us") || sym.contains(".") ? sym : sym + ".us";
            String url = "https://stooq.com/q/l/?s=" + querySymbol + "&f=sd2t2ohlcv&h&e=csv";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0 (Java)")
                    .header("Accept", "text/csv, */*")
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            log.debug("Fetched {} -> status {} bodyLen={}", ticker, resp.statusCode(), resp.body() == null ? 0 : resp.body().length());
            if (resp.statusCode() != 200) {
                log.warn("Non-200 fetching price for {}: {}", ticker, resp.statusCode());
                return null;
            }
            String body = resp.body();
            if (body == null || body.isBlank()) return null;
            BufferedReader br = new BufferedReader(new StringReader(body));
            String header = br.readLine();
            String data = br.readLine();
            if (data == null) return null;
            // Parse CSV by header to find the Close column.
            String[] cols = header.split(",");
            String[] vals = data.split(",");
            int closeIdx = -1;
            for (int i = 0; i < cols.length; i++) {
                if (cols[i].trim().equalsIgnoreCase("close")) { closeIdx = i; break; }
            }
            if (closeIdx == -1) {
                // Fallback: try typical position (6th column, 0-based index 6 for Close in sd2t2ohlcv)
                closeIdx = Math.min(6, vals.length - 1);
            }
            String closeStr = vals.length > closeIdx ? vals[closeIdx].trim() : null;
            if (closeStr == null || closeStr.isEmpty() || closeStr.equalsIgnoreCase("N/D")) return null;
            // Remove potential quotes
            if (closeStr.startsWith("\"") && closeStr.endsWith("\"")) closeStr = closeStr.substring(1, closeStr.length()-1);
            return Double.parseDouble(closeStr);
        } catch (Exception e) {
            log.warn("Exception fetching price for {}: {}", ticker, e.getMessage());
        }
        return null;
    }
}
