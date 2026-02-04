package com.example.controller;

import com.example.entity.StockEntity;
import com.example.entity.WatchlistEntry;
import com.example.repository.WatchlistRepository;
import com.example.service.StockService;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.server.mvc.WebMvcLinkBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
public class StockController {
    private final StockService service;
    private final WatchlistRepository watchRepo;
    private final com.example.repository.UserRepository userRepo;

    public StockController(StockService service, WatchlistRepository watchRepo, com.example.repository.UserRepository userRepo) {
        this.service = service;
        this.watchRepo = watchRepo;
        this.userRepo = userRepo;
    }

    private boolean authorized(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) return false;
        String prefix = "Bearer ";
        if (!authHeader.startsWith(prefix)) return false;
        String token = authHeader.substring(prefix.length());
        return userRepo.findByToken(token).isPresent();
    }

    @GetMapping("/stock")
    public ResponseEntity<?> getStock(@RequestParam(name = "ticker") String ticker, @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().body("ticker is required");
        StockEntity s = service.getStock(ticker);
        if (s == null) return ResponseEntity.status(502).body("failed to fetch price");
        EntityModel<StockEntity> model = EntityModel.of(s);
        model.add(WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).getStock(ticker, auth)).withSelfRel());
        model.add(WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).addToWatchlist(ticker, auth)).withRel("add-to-watchlist"));
        return ResponseEntity.ok(model);
    }

    @PostMapping("/watchlist")
    public ResponseEntity<?> addToWatchlist(@RequestParam(name = "ticker") String ticker, @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().body("ticker is required");
        WatchlistEntry e = new WatchlistEntry(ticker.toUpperCase(), Instant.now().toEpochMilli());
        watchRepo.save(e);
        EntityModel<WatchlistEntry> model = EntityModel.of(e);
        model.add(WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).getWatchlist(auth)).withRel("watchlist"));
        return ResponseEntity.ok(model);
    }

    @GetMapping("/watchlist")
    public ResponseEntity<?> getWatchlist(@RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        List<WatchlistEntry> list = watchRepo.findAllByOrderByAddedAtDesc();
        List<EntityModel<WatchlistEntry>> models = list.stream()
            .map(e -> EntityModel.of(e,
                WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).getWatchlist(auth)).withRel("watchlist")))
                .collect(Collectors.toList());
        CollectionModel<EntityModel<WatchlistEntry>> coll = CollectionModel.of(models);
        coll.add(WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).getWatchlist(auth)).withSelfRel());
        return ResponseEntity.ok(coll);
    }

    @DeleteMapping("/watchlist/{id}")
    public ResponseEntity<?> deleteFromWatchlistById(@PathVariable("id") Long id, @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (!watchRepo.existsById(id)) return ResponseEntity.notFound().build();
        watchRepo.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/watchlist")
    public ResponseEntity<?> deleteFromWatchlistByTicker(@RequestParam(name = "ticker") String ticker, @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().body("ticker is required");
        watchRepo.deleteByTicker(ticker.toUpperCase());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/watchlist/remove")
    @Transactional
    public ResponseEntity<?> removeFromWatchlist(@RequestParam(name = "id", required = false) Long id,
                                                 @RequestParam(name = "ticker", required = false) String ticker,
                                                 @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (id != null) {
            if (!watchRepo.existsById(id)) return ResponseEntity.notFound().build();
            watchRepo.deleteById(id);
            return ResponseEntity.ok().build();
        }
        if (ticker != null && !ticker.isBlank()) {
            watchRepo.deleteByTicker(ticker.toUpperCase());
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.badRequest().body("id or ticker required");
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam(name = "ticker") String ticker, @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!authorized(auth)) return ResponseEntity.status(401).body("unauthorized");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().body("ticker required");
        StockEntity s = service.getStock(ticker);
        if (s == null) return ResponseEntity.status(502).body("failed to fetch");
        EntityModel<StockEntity> model = EntityModel.of(s);
        model.add(WebMvcLinkBuilder.linkTo(WebMvcLinkBuilder.methodOn(StockController.class).addToWatchlist(ticker, auth)).withRel("add-to-watchlist"));
        return ResponseEntity.ok(model);
    }
}
