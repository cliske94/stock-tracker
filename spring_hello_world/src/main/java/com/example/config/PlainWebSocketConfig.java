package com.example.config;

import com.example.websocket.PlainWebSocketHandler;
import com.example.websocket.WebSocketSessionService;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class PlainWebSocketConfig implements WebSocketConfigurer {
    private final WebSocketSessionService sessionService;

    public PlainWebSocketConfig(WebSocketSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new PlainWebSocketHandler(sessionService), "/ws-plain").setAllowedOriginPatterns("*");
    }
}
