package com.example;

import com.example.entity.StockEntity;
import com.example.repository.StockRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public class StockRepositoryTest {
    @Autowired StockRepository repo;

    @Test
    public void saveAndFind() {
        StockEntity s = new StockEntity("TST", 12.34, System.currentTimeMillis());
        repo.save(s);
        StockEntity got = repo.findById("TST").orElse(null);
        assertThat(got).isNotNull();
        assertThat(got.getTicker()).isEqualTo("TST");
    }
}
