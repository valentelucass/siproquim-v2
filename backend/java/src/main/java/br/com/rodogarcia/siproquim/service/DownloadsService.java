package br.com.rodogarcia.siproquim.service;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DownloadsService {
  private final Path pasta;

  public DownloadsService(@Value("${siproquim.downloads}") String pasta) {
    this.pasta = Path.of(pasta).toAbsolutePath().normalize();
  }

  public record Salvo(String nome, String caminho) {}

  public Salvo salvar(String nome, byte[] conteudo) throws IOException {
    if (!nome.matches("M[0-9]{4}[A-Z]{3}[0-9]{14}\\.txt")) {
      throw new IllegalArgumentException("Nome de TXT inesperado.");
    }
    Files.createDirectories(pasta);
    String base = nome.substring(0, nome.length() - 4);
    Path temporario = Files.createTempFile(pasta, ".siproquim-", ".part");
    try {
      Files.write(temporario, conteudo);
      for (int copia = 0; ; copia++) {
        Path destino = pasta.resolve(copia == 0 ? nome : base + " (" + copia + ").txt");
        try {
          // O move sem REPLACE_EXISTING mantém arquivos já presentes em Downloads.
          Files.move(temporario, destino);
          return new Salvo(destino.getFileName().toString(), destino.toString());
        } catch (FileAlreadyExistsException ocupado) {
          // Outro download já usou este nome.
        }
      }
    } finally {
      Files.deleteIfExists(temporario);
    }
  }
}
