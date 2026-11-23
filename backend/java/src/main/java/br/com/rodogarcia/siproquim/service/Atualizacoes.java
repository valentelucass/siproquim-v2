package br.com.rodogarcia.siproquim.service;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class Atualizacoes {
  static final String INSTALADOR = "Siproquim-Rodogarcia-x64.msi";
  private final String atual, canal;
  private final Path downloads;
  private final boolean desktop;
  private final JsonMapper json;
  private final PublicKey chave;
  private Manifesto ultimo;
  private long consultado;

  public record Manifesto(String versao, String sha256, String assinatura) {}
  public record Estado(String instalada, String disponivel) {}
  public record Instalacao(String caminho, boolean iniciado) {}

  public Atualizacoes(JsonMapper json, @Value("${siproquim.versao}") String atual,
      @Value("${siproquim.canal}") String canal, @Value("${siproquim.downloads}") String downloads,
      @Value("${siproquim.desktop:false}") boolean desktop) throws Exception {
    this.json = json;
    this.atual = atual;
    this.canal = canal;
    this.downloads = Path.of(downloads).toAbsolutePath();
    this.desktop = desktop;
    try (var in = new ClassPathResource("atualizacao.pub").getInputStream()) {
      chave = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getMimeDecoder().decode(in.readAllBytes())));
    }
  }

  static boolean maisNova(String versao, String instalada) {
    return Runtime.Version.parse(versao.replaceFirst("(\\.0)+$", "")).compareTo(
        Runtime.Version.parse(instalada.replaceFirst("(\\.0)+$", ""))) > 0;
  }

  static void autenticar(Manifesto m, PublicKey chave) throws GeneralSecurityException {
    if (m == null || m.versao() == null || !m.versao().matches("[1-9][0-9]{0,4}(\\.(0|[1-9][0-9]{0,4})){2}")
        || m.sha256() == null || !m.sha256().matches("[0-9a-f]{64}") || m.assinatura() == null) {
      throw new SignatureException("Manifesto inválido.");
    }
    var assinatura = Signature.getInstance("SHA256withRSA");
    assinatura.initVerify(chave);
    assinatura.update((m.versao() + "\n" + m.sha256() + "\n").getBytes(StandardCharsets.UTF_8));
    if (!assinatura.verify(Base64.getDecoder().decode(m.assinatura()))) throw new SignatureException();
  }

  private InputStream abrir(String recurso) throws IOException {
    var conexao = (HttpURLConnection) URI.create(canal + recurso).toURL().openConnection();
    conexao.setConnectTimeout(5000);
    conexao.setReadTimeout(15000);
    conexao.setUseCaches(false);
    conexao.setRequestProperty("User-Agent", "Rodogarcia-Siproquim/" + atual);
    return conexao.getInputStream();
  }

  private synchronized Manifesto consultar() {
    long agora = System.nanoTime();
    if (ultimo != null && agora - consultado < 60_000_000_000L) return ultimo;
    try (var in = abrir("/latest/download/atualizacao.json")) {
      byte[] bytes = in.readNBytes(8193);
      if (bytes.length > 8192) throw new IOException();
      var manifesto = json.readValue(bytes, Manifesto.class);
      autenticar(manifesto, chave);
      ultimo = manifesto;
      consultado = agora;
      return manifesto;
    } catch (GeneralSecurityException | IllegalArgumentException erro) {
      throw new Falha(HttpStatus.BAD_GATEWAY, "A assinatura da atualização é inválida.");
    } catch (IOException erro) {
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "Não foi possível consultar a versão publicada. Tente novamente.");
    }
  }

  public Estado estado() {
    var m = consultar();
    return new Estado(atual, maisNova(m.versao(), atual) ? m.versao() : null);
  }

  public synchronized Instalacao instalar(String solicitada) {
    var m = consultar();
    if (!m.versao().equals(solicitada) || !maisNova(m.versao(), atual))
      throw Falha.conflito("Consulte novamente a versão disponível.");
    Path parte = null;
    try {
      Files.createDirectories(downloads);
      parte = Files.createTempFile(downloads, ".siproquim-", ".part");
      try (var in = abrir("/download/v" + m.versao() + "/" + INSTALADOR);
           var out = Files.newOutputStream(parte)) {
        verificarPacote(in, out, m.sha256());
      }
      Path pronto = downloads.resolve("Siproquim-" + m.versao() + "-" + UUID.randomUUID().toString().substring(0,8) + ".msi");
      Files.move(parte, pronto);
      if (desktop) {
        var msiexec = Path.of(System.getenv("SystemRoot"), "System32", "msiexec.exe");
        var instalador = new ProcessBuilder(msiexec.toString(), "/i", pronto.toString()).start();
        String atalho = System.getenv("SIPROQUIM_ATALHO");
        if (atalho != null) instalador.onExit().thenAccept(processo -> {
          if (processo.exitValue() == 0) {
            try { new ProcessBuilder(atalho).start(); }
            catch (IOException e) { System.getLogger("Siproquim").log(System.Logger.Level.WARNING, "Abra o aplicativo pelo atalho para concluir a atualização."); }
          }
        });
      }
      return new Instalacao(pronto.toString(), desktop);
    } catch (GeneralSecurityException erro) {
      throw new Falha(HttpStatus.BAD_GATEWAY, "O instalador não passou na verificação. Tente baixar novamente.");
    } catch (IOException erro) {
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "Falha ao preparar o instalador. Confira a conexão e a pasta Downloads.");
    } finally {
      if (parte != null) try { Files.deleteIfExists(parte); } catch (IOException ignorada) {}
    }
  }

  static void verificarPacote(InputStream in, OutputStream out, String esperado) throws IOException, GeneralSecurityException {
    var hash = MessageDigest.getInstance("SHA-256");
    long total = 0;
    byte[] buffer = new byte[64 * 1024];
    for (int n; (n = in.read(buffer)) != -1;) {
      total += n;
      if (total > 512L * 1024 * 1024) throw new IOException("Instalador excede o limite.");
      hash.update(buffer, 0, n);
      out.write(buffer, 0, n);
    }
    if (!HexFormat.of().formatHex(hash.digest()).equals(esperado)) throw new SignatureException();
  }
}
