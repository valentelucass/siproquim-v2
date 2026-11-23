package br.com.rodogarcia.siproquim.service;

import br.com.rodogarcia.siproquim.model.Registros.Extracao;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class ExtratorPdf {
  private final JsonMapper mapper;
  private final String python;
  private final Path script;
  private final long timeout;
  private final Semaphore limite = new Semaphore(2, true);

  public ExtratorPdf(
      JsonMapper mapper,
      @Value("${siproquim.python}") String python,
      @Value("${siproquim.extrator}") String script,
      @Value("${siproquim.tempo-extracao-segundos}") long timeout) {
    this.mapper = mapper;
    this.python = python;
    this.script = Path.of(script).toAbsolutePath().normalize();
    this.timeout = timeout;
  }

  public Extracao extrair(byte[] pdf) {
    if (pdf.length < 5
        || pdf[0] != '%'
        || pdf[1] != 'P'
        || pdf[2] != 'D'
        || pdf[3] != 'F'
        || pdf[4] != '-') throw Falha.dados("O arquivo enviado não possui cabeçalho PDF.");
    if (!limite.tryAcquire())
      throw new Falha(
          HttpStatus.TOO_MANY_REQUESTS, "Há duas extrações em andamento. Tente novamente.");
    try {
      return executar(pdf);
    } finally {
      limite.release();
    }
  }

  private Extracao executar(byte[] pdf) {
    Path pasta = null;
    Process processo = null;
    try {
      pasta = Files.createTempDirectory("siproquim-extracao-");
      Path entrada = pasta.resolve("entrada.pdf"),
          saida = pasta.resolve("saida.json"),
          erro = pasta.resolve("erro.txt");
      Files.write(entrada, pdf);
      var builder = new ProcessBuilder(python, "-B", script.toString(), entrada.toString());
      builder.environment().put("PYTHONIOENCODING", "utf-8");
      processo = builder.redirectOutput(saida.toFile()).redirectError(erro.toFile()).start();
      if (!processo.waitFor(timeout, TimeUnit.SECONDS))
        throw Falha.dados("Tempo de extração excedido. Confira o PDF.");
      if (processo.exitValue() != 0) {
        String log = Files.readString(erro);
        var pagina = java.util.regex.Pattern.compile("página (\\d+)").matcher(log);
        if (log.contains("ModuleNotFoundError") || !Files.isRegularFile(script))
          throw new Falha(
              HttpStatus.SERVICE_UNAVAILABLE,
              "Confira a instalação e as dependências do extrator Python.");
        throw Falha.dados(
            "Falha ao ler o relatório"
                + (pagina.find() ? " na página " + pagina.group(1) : "")
                + ". Confira o arquivo.");
      }
      return mapper.readValue(saida.toFile(), Extracao.class);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "Extração interrompida.");
    } catch (IOException e) {
      throw new Falha(
          HttpStatus.SERVICE_UNAVAILABLE, "Confira o executável Python e o diretório temporário.");
    } finally {
      if (processo != null && processo.isAlive()) processo.destroyForcibly().onExit().join();
      if (pasta != null)
        for (String nome : new String[] {"entrada.pdf", "saida.json", "erro.txt", ""}) {
          try {
            Files.deleteIfExists(pasta.resolve(nome));
          } catch (IOException e) {
            pasta.resolve(nome).toFile().deleteOnExit();
          }
        }
    }
  }
}
