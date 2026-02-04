package com.example.entity;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.TableGenerator;
import javax.persistence.Table;

@Entity
@Table(name = "watchlist")
public class WatchlistEntry {
    @Id
    @TableGenerator(
            name = "watchlist_id_gen",
            table = "hibernate_sequences",
            pkColumnName = "sequence_name",
            valueColumnName = "next_val",
            pkColumnValue = "watchlist",
            allocationSize = 1
    )
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "watchlist_id_gen")
    private Long id;
    private String ticker;
    private long addedAt;

    public WatchlistEntry() {}

    public WatchlistEntry(String ticker, long addedAt) {
        this.ticker = ticker;
        this.addedAt = addedAt;
    }

    public Long getId() { return id; }
    public String getTicker() { return ticker; }
    public void setTicker(String ticker) { this.ticker = ticker; }
    public long getAddedAt() { return addedAt; }
    public void setAddedAt(long addedAt) { this.addedAt = addedAt; }
}
