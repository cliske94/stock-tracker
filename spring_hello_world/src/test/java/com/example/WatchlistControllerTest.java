package com.example;

import com.example.entity.WatchlistEntry;
import com.example.repository.WatchlistRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import com.example.entity.User;
import com.example.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class WatchlistControllerTest {
    @Autowired MockMvc mvc;
    @Autowired WatchlistRepository repo;
    @Autowired UserRepository userRepo;

    @Test
    public void addAndGetWatchlist() throws Exception {
        repo.deleteAll();
        userRepo.deleteAll();
        // create a user and token for Authorization
        User u = new User("test", "hash", "tok-123");
        userRepo.save(u);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Bearer tok-123");

        mvc.perform(post("/watchlist?ticker=ABC").headers(headers).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticker").value("ABC"));
        mvc.perform(get("/watchlist").headers(headers)).andExpect(status().isOk())
            .andExpect(jsonPath("$._embedded").exists());
    }
}
