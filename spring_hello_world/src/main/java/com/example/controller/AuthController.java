package com.example.controller;

import com.example.entity.User;
import com.example.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.mindrot.jbcrypt.BCrypt;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final UserRepository userRepo;
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    public AuthController(UserRepository userRepo) { this.userRepo = userRepo; }

    private String hash(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt(12));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String,String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || password == null) return ResponseEntity.badRequest().body("username and password required");
        Optional<User> existing = userRepo.findByUsername(username);
        if (existing.isPresent()) return ResponseEntity.status(409).body("username exists");
        String hash = hash(password);
        String token = UUID.randomUUID().toString();
        User u = new User(username, hash, token);
        userRepo.save(u);
        Map<String,String> resp = new HashMap<>();
        resp.put("token", token);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String,String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || password == null) return ResponseEntity.badRequest().body("username and password required");
        Optional<User> uo = userRepo.findByUsername(username);
        if (uo.isEmpty()) return ResponseEntity.status(401).body("invalid credentials");
        User u = uo.get();
        if (!BCrypt.checkpw(password, u.getPasswordHash())) return ResponseEntity.status(401).body("invalid credentials");
        String token = UUID.randomUUID().toString();
        u.setToken(token);
        userRepo.save(u);
        Map<String,String> resp = new HashMap<>();
        resp.put("token", token);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String auth) {
        if (auth == null || auth.isBlank()) return ResponseEntity.status(401).body("unauthorized");
        String prefix = "Bearer ";
        if (!auth.startsWith(prefix)) return ResponseEntity.status(401).body("unauthorized");
        String token = auth.substring(prefix.length());
        Optional<User> uo = userRepo.findByToken(token);
        if (uo.isEmpty()) return ResponseEntity.status(401).body("invalid token");
        User u = uo.get();
        u.setToken(null);
        userRepo.save(u);
        return ResponseEntity.ok().build();
    }
}
