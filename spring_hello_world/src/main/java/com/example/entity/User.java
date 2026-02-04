package com.example.entity;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Column;
import javax.persistence.Table;
import javax.persistence.TableGenerator;

@Entity
@Table(name = "users")
public class User {
    @Id
        @TableGenerator(
            name = "user_id_gen",
            table = "hibernate_sequences",
            pkColumnName = "sequence_name",
            valueColumnName = "next_val",
            pkColumnValue = "users",
            allocationSize = 1
        )
        @GeneratedValue(strategy = GenerationType.TABLE, generator = "user_id_gen")
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Column(unique = true)
    private String token;

    public User() {}

    public User(String username, String passwordHash, String token) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.token = token;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
