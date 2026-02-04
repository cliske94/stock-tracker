package com.example.websocket;

import com.example.entity.StockEntity;
import com.example.entity.WatchlistEntry;
import com.example.repository.StockRepository;
import com.example.repository.WatchlistRepository;
import com.example.service.StockService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class WatchlistBroadcaster {
    private static final Logger log = LoggerFactory.getLogger(WatchlistBroadcaster.class);
    private final StockRepository repo;
    private final StockService stockService;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.example.websocket.WebSocketSessionService sessionService;
    private final WatchlistRepository watchRepo;

    public WatchlistBroadcaster(StockRepository repo, WatchlistRepository watchRepo, StockService stockService, SimpMessagingTemplate messagingTemplate, com.example.websocket.WebSocketSessionService sessionService) {
        this.repo = repo;
        this.watchRepo = watchRepo;
        this.stockService = stockService;
        this.messagingTemplate = messagingTemplate;
        this.sessionService = sessionService;
    }

    // default: every 5 seconds, configurable via property if needed
    @Scheduled(fixedDelayString = "${stocks.update.ms:5000}")
    public void broadcastWatchlistPrices() {
        try {
            List<WatchlistEntry> entries = watchRepo.findAllByOrderByAddedAtDesc();
            if (entries == null || entries.isEmpty()) return;
            List<PriceUpdate> updates = new ArrayList<>();
            for (WatchlistEntry we : entries) {
                try {
                    String ticker = we.getTicker();
                    StockEntity fresh = stockService.getStock(ticker);
                    if (fresh != null) {
                        updates.add(new PriceUpdate(we.getId(), fresh.getTicker(), fresh.getPrice(), Instant.now().toEpochMilli()));
                    }
                } catch (Exception ex) {
                    log.warn("Error updating {}: {}", we.getTicker(), ex.getMessage());
                }
            }
            if (!updates.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/prices", updates);
                try {
                    // Send plain JSON array over plain websockets as well
                    String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(updates);
                    sessionService.sendToAll(json);
                } catch (Exception ex) {
                    log.warn("Failed to send plain websocket broadcast: {}", ex.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Watchlist broadcast failed: {}", e.getMessage());
        }
    }
}
