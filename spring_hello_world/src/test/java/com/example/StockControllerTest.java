package com.example;

import com.example.controller.StockController;
import com.example.entity.StockEntity;
import com.example.entity.User;
import com.example.repository.UserRepository;
import com.example.service.StockService;
import com.example.repository.WatchlistRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StockController.class)
public class StockControllerTest {
    @Autowired MockMvc mvc;
    @MockBean StockService stockService;
    @MockBean WatchlistRepository watchRepo;
    @MockBean UserRepository userRepo;

    @Test
    public void search_requiresAuth() throws Exception {
        // unauthorized without token
        mvc.perform(get("/search?ticker=F").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void search_returnsStockWhenAuthorized() throws Exception {
        StockEntity s = new StockEntity("F", 9.99, System.currentTimeMillis());
        when(stockService.getStock(anyString())).thenReturn(s);
        when(userRepo.findByToken("good-token")).thenReturn(Optional.of(new User("u","h","good-token")));

        mvc.perform(get("/search?ticker=F").header("Authorization", "Bearer good-token").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticker").value("F"));
    }
}
