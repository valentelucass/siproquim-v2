package br.com.rodogarcia.siproquim.service;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;
import java.util.concurrent.TimeUnit;
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

  private synchronized Manifesto consultar(boolean forcar) {
    long agora = System.nanoTime();
    if (!forcar && ultimo != null && agora - consultado < 25_000_000_000L) return ultimo;
    // O redirecionamento latest do GitHub também pode ser guardado por caches intermediários.
    try (var in = abrir("/latest/download/atualizacao.json?consulta=" + System.currentTimeMillis())) {
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

  public Estado estado(boolean forcar) {
    var m = consultar(forcar);
    return new Estado(atual, maisNova(m.versao(), atual) ? m.versao() : null);
  }

  public synchronized Instalacao instalar(String solicitada) {
    var m = consultar(false);
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
        instalarNoWindows(pronto);
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

  private void instalarNoWindows(Path pacote) {
    String atalho = System.getenv("SIPROQUIM_ATALHO");
    String janela = System.getenv("SIPROQUIM_JANELA");
    if (atalho == null || janela == null || !Files.isRegularFile(Path.of(atalho)) || !Files.isRegularFile(Path.of(janela)))
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "Abra o SIPROQUIM pelo atalho do Windows e tente atualizar novamente.");
    Path destino = Path.of(atalho).toAbsolutePath().getParent();
    try {
      var instalador = new ProcessBuilder(janela, "--instalar", pacote.toString(), destino.toString())
          .redirectOutput(ProcessBuilder.Redirect.DISCARD)
          .redirectError(ProcessBuilder.Redirect.DISCARD)
          .start();
      if (!instalador.waitFor(5, TimeUnit.MINUTES))
        throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "O Windows ainda está instalando a atualização. Aguarde e abra o SIPROQUIM pelo atalho.");
      int codigo = instalador.exitValue();
      if (codigo == 1618)
        throw Falha.conflito("O Windows está fazendo outra instalação. Quando ela terminar, tente atualizar novamente.");
      if (codigo == 3010)
        throw Falha.conflito("O Windows precisa ser reiniciado para concluir a atualização do SIPROQUIM.");
      if (codigo != 0)
        throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "O Windows não concluiu a atualização. Código " + codigo + ". Tente novamente.");
    } catch (IOException erro) {
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "O Windows não abriu o instalador. Tente novamente.");
    } catch (InterruptedException erro) {
      Thread.currentThread().interrupt();
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "A consulta do instalador foi interrompida. Abra o SIPROQUIM pelo atalho.");
    }
    try {
      new ProcessBuilder(atalho).start();
    } catch (IOException erro) {
      throw new Falha(HttpStatus.SERVICE_UNAVAILABLE, "A atualização foi instalada. Abra o SIPROQUIM novamente pelo atalho.");
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
