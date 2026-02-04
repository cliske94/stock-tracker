package com.example.websocket;

public class PriceUpdate {
    private Long id;
    private String ticker;
    private Double price;
    private long timestamp;

    public PriceUpdate() {}

    public PriceUpdate(Long id, String ticker, Double price, long timestamp) {
        this.id = id;
        this.ticker = ticker;
        this.price = price;
        this.timestamp = timestamp;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTicker() { return ticker; }
    public void setTicker(String ticker) { this.ticker = ticker; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
