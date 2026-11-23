package br.com.rodogarcia.siproquim.config;

import java.io.IOException;
import java.nio.file.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.sqlite.*;

@Configuration
public class Config {
  @Bean
  DataSource dataSource(@Value("${siproquim.dados}") String caminho) throws IOException {
    Path pasta = Path.of(caminho).toAbsolutePath().normalize();
    Files.createDirectories(pasta);
    SQLiteConfig regras = new SQLiteConfig();
    regras.enforceForeignKeys(true);
    regras.setBusyTimeout(15000);
    regras.setJournalMode(SQLiteConfig.JournalMode.WAL);
    regras.setTransactionMode(SQLiteConfig.TransactionMode.IMMEDIATE);
    SQLiteDataSource fonte = new SQLiteDataSource(regras);
    fonte.setUrl("jdbc:sqlite:" + pasta.resolve("mapas.sqlite").toAbsolutePath());
    return fonte;
  }
}
