package com.example.model;

public class Stock {
    private String ticker;
    private double price;
    private long fetchedAt;

    public Stock() {}

    public Stock(String ticker, double price, long fetchedAt) {
        this.ticker = ticker;
        this.price = price;
        this.fetchedAt = fetchedAt;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public long getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(long fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
}
