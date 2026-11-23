package br.com.rodogarcia.siproquim;

import static org.junit.jupiter.api.Assertions.*;

import br.com.rodogarcia.siproquim.model.Registros.*;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "siproquim.extrator=../python/extrair.py")
class BackendHttpTest {
  @LocalServerPort int port;
  static final String TOKEN = "token-sintetico-de-integracao";
  static final JsonMapper JSON = JsonMapper.builder().build();
  static final HttpClient CLIENT = HttpClient.newHttpClient();
  @org.junit.jupiter.api.io.TempDir static Path diretorio;

  @DynamicPropertySource
  static void dados(DynamicPropertyRegistry r) {
    r.add("siproquim.downloads", () -> diretorio.resolve("Downloads").toString());
    r.add("siproquim.dados", () -> diretorio.toAbsolutePath().toString());
  }

  HttpRequest.Builder req(String path) {
    return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api" + path));
  }

  HttpResponse<byte[]> enviar(HttpRequest request) throws Exception {
    return CLIENT.send(request, HttpResponse.BodyHandlers.ofByteArray());
  }

  JsonNode body(HttpResponse<byte[]> r) {
    return JSON.readTree(r.body());
  }

  HttpResponse<byte[]> json(String method, String path, Object objeto) throws Exception {
    return enviar(
        req(path)
            .header("X-Siproquim-Token", TOKEN)
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofByteArray(JSON.writeValueAsBytes(objeto)))
            .build());
  }

  HttpResponse<byte[]> upload(String path, String nome, byte[] bytes) throws Exception {
    var out = new ByteArrayOutputStream();
    out.write(
        ("--limite\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\""
                + nome
                + "\"\r\n"
                + "Content-Type: application/octet-stream\r\n\r\n")
            .getBytes(StandardCharsets.UTF_8));
    out.write(bytes);
    out.write("\r\n--limite--\r\n".getBytes(StandardCharsets.UTF_8));
    return enviar(
        req(path)
            .header("X-Siproquim-Token", TOKEN)
            .header("Content-Type", "multipart/form-data; boundary=limite")
            .POST(HttpRequest.BodyPublishers.ofByteArray(out.toByteArray()))
            .build());
  }

  @Test
  void inicializaComCaminhoRelativoDoExtratorEAcessoLocal() throws Exception {
    assertEquals(200, enviar(req("/saude").GET().build()).statusCode());
    assertEquals(401, enviar(req("/lotes").GET().build()).statusCode());
    assertTrue(Files.isRegularFile(diretorio.resolve("mapas.sqlite")));
  }

  @Test
  void preflightDaInterfacePodeUsarToken() throws Exception {
    var r =
        enviar(
            req("/lotes")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "X-Siproquim-Token")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build());
    assertEquals(200, r.statusCode());
    assertEquals(
        "http://localhost:5173",
        r.headers().firstValue("Access-Control-Allow-Origin").orElseThrow());
  }

  @Test
  void mesSemFretesExigeDeclaracaoExplicitaEExportaSomenteEm() throws Exception {
    var invalida = Map.of("cnpj", "11222333000181", "competencia", "2026-05", "evidencia", "");
    assertEquals(422, json("POST", "/lotes/sem-movimento", invalida).statusCode());
    var pedido =
        Map.of(
            "cnpj",
            "11222333000181",
            "competencia",
            "2026-05",
            "evidencia",
            "Conferência mensal concluída.");
    var r = json("POST", "/lotes/sem-movimento", pedido);
    assertEquals(200, r.statusCode());
    String base = "/lotes/" + body(r).at("/lote/id").asString();
    assertEquals(
        404,
        enviar(req(base + "/pdf").header("X-Siproquim-Token", TOKEN).GET().build()).statusCode());
    assertEquals(200, json("POST", base + "/exportar", Map.of("versao", 1)).statusCode());
    String txt =
        new String(
            enviar(req(base + "/txt").header("X-Siproquim-Token", TOKEN).GET().build()).body(),
            StandardCharsets.UTF_8);
    assertEquals(1, txt.lines().count());
    assertTrue(txt.startsWith("EM11222333000181MAI2026"));
    assertEquals(
        422,
        upload(
                "/lotes?cnpj=11222333000181&competencia=2026-06",
                "invalido.pdf",
                "sem dados".getBytes())
            .statusCode());
  }

  @Test
  void duasCorrecoesConcorrentesNaoSobrescrevemAEvidencia() throws Exception {
    var path = Path.of("../python/tests/frete-sintetico.pdf");
    var lote =
        body(
            upload(
                "/lotes?cnpj=11222333000181&competencia=2026-07",
                "concorrencia.pdf",
                Files.readAllBytes(path)));
    String base = "/lotes/" + lote.at("/lote/id").asString();
    try (var trabalhadores = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
      var inicio = new java.util.concurrent.CountDownLatch(1);
      var chamadas = new ArrayList<java.util.concurrent.Future<Integer>>();
      for (String valor : List.of("PRIMEIRO", "SEGUNDO"))
        chamadas.add(
            trabalhadores.submit(
                () -> {
                  inicio.await();
                  return json(
                          "PATCH",
                          base + "/operacoes",
                          new Correcao(1, 1, Map.of("recebedor", valor), "teste concorrente"))
                      .statusCode();
                }));
      inicio.countDown();
      var respostas = List.of(chamadas.get(0).get(), chamadas.get(1).get());
      assertTrue(respostas.containsAll(List.of(200, 409)), respostas.toString());
    }
    assertEquals(
        2,
        body(enviar(req(base + "/historico").header("X-Siproquim-Token", TOKEN).GET().build()))
            .size());
  }

  @Test
  void migracaoDaMemoriaV1MantemEscopoQuarentenaEIdempotencia() throws Exception {
    Path db = diretorio.resolve("copia-sintetica.sqlite");
    try (var conn = java.sql.DriverManager.getConnection("jdbc:sqlite:" + db);
        var sql = conn.createStatement()) {
      sql.execute(
          "CREATE TABLE learned_pairs(nome_original TEXT,documento TEXT,campo TEXT,status TEXT)");
      sql.execute(
          "INSERT INTO learned_pairs VALUES('EXEMPLO"
              + " V1','11222333000181','emitente','ativo'),('EXEMPLO"
              + " V1','11111111111111','emitente','ativo'),('OUTRA"
              + " EMPRESA','11222333000181','contratante','quarentena')");
    }
    byte[] backup = Files.readAllBytes(db);
    String endpoint = "/memoria/importar-v1?evidencia=copia-sintetica";
    var r = upload(endpoint, "legado.sqlite", backup);
    assertEquals(200, r.statusCode(), () -> new String(r.body(), StandardCharsets.UTF_8));
    assertEquals(1, body(r).get("ativosValidos").asInt());
    assertEquals(2, body(r).get("ignorados").asInt());
    assertEquals(0, body(upload(endpoint, "legado.sqlite", backup)).get("novosVinculos").asInt());
    String busca = "/memoria?filial=11222333000181&papel=origem&nome=EXEMPLO%20V1";
    assertEquals(
        0, body(enviar(req(busca).header("X-Siproquim-Token", TOKEN).GET().build())).size());
    assertEquals(
        "LEGADO",
        body(enviar(
                req(busca + "&incluirLegado=true")
                    .header("X-Siproquim-Token", TOKEN)
                    .GET()
                    .build()))
            .get(0)
            .get("escopo")
            .asString());
    assertArrayEquals(backup, Files.readAllBytes(db));
  }

  @Test
  void previaTemOsBytesDaExportacaoSemAlterarVersaoOuEstado() throws Exception {
    var pedido = Map.of("cnpj", "11222333000181", "competencia", "2024-08", "evidencia", "teste");
    String base = "/lotes/" + body(json("POST", "/lotes/sem-movimento", pedido)).at("/lote/id").asString();
    var previa = enviar(req(base + "/previa-txt").header("X-Siproquim-Token", TOKEN).GET().build());
    assertEquals(200, previa.statusCode());
    var lote = body(enviar(req(base).header("X-Siproquim-Token", TOKEN).GET().build()));
    assertEquals("CONFERENCIA", lote.at("/lote/estado").asString());
    assertEquals(1, lote.at("/lote/versao").asInt());
    assertEquals(200, json("POST", base + "/exportar", Map.of("versao", 1)).statusCode());
    assertArrayEquals(previa.body(), enviar(req(base + "/txt").header("X-Siproquim-Token", TOKEN).GET().build()).body());
  }

  @Test
  void baixaTxtEmDownloadsSemSobrescreverOExistente() throws Exception {
    var id=body(json("POST","/lotes/sem-movimento",Map.of("cnpj","11222333000181","competencia","2023-11","evidencia","Teste"))).at("/lote/id").asString();
    String base="/lotes/"+id;
    assertEquals(200,json("POST",base+"/exportar",Map.of("versao",1)).statusCode());
    byte[] bytes=enviar(req(base+"/txt").header("X-Siproquim-Token",TOKEN).GET().build()).body();
    Path pasta=Files.createDirectories(diretorio.resolve("Downloads"));
    String nome="M2023NOV11222333000181.txt";
    Files.writeString(pasta.resolve(nome),"arquivo anterior");
    var gravado=json("POST",base+"/salvar-txt",Map.of());
    assertEquals(200,gravado.statusCode());
    String gerado=body(gravado).get("nome").asString();
    assertEquals("M2023NOV11222333000181 (1).txt",gerado);
    assertEquals("arquivo anterior",Files.readString(pasta.resolve(nome)));
    assertArrayEquals(bytes,Files.readAllBytes(pasta.resolve(gerado)));
  }

  @Test
  void listaFiliaisDaV1SemPerderZerosOuConfundirEmpresas() throws Exception {
    var filiais = body(enviar(req("/filiais").header("X-Siproquim-Token", TOKEN).GET().build()));
    assertEquals(19, filiais.size());
    var porCnpj = new java.util.HashMap<String, String>();
    for (var filial : filiais) {
      String cnpj = filial.get("cnpj").asString();
      assertTrue(cnpj.matches("[0-9]{14}"));
      assertNull(porCnpj.put(cnpj, filial.get("sigla").asString() + "/" + filial.get("empresa").asString()));
    }
    assertEquals("AGU/Dalga Logística", porCnpj.get("04547874000386"));
    assertEquals("CPQ/TR Rodogarcia", porCnpj.get("51863654000341"));
    assertEquals("CPQ/Rodogarcia", porCnpj.get("60960473000758"));
  }

  @Test
  void reciboConservaDataOficialAoRetificar() throws Exception {
    var pedido =
        Map.of("cnpj", "11222333000181", "competencia", "2025-02", "evidencia", "mês conferido");
    String base =
        "/lotes/" + body(json("POST", "/lotes/sem-movimento", pedido)).at("/lote/id").asString();
    assertEquals(200, json("POST", base + "/exportar", Map.of("versao", 1)).statusCode());
    assertEquals(200, json("POST", base + "/processamento", new Acao(2, "teste")).statusCode());
    var recibo =
        new HashMap<String, Object>(
            Map.of("versao", 3, "protocolo", "P-ANEXO", "evidencia", "recibo conferido"));
    assertEquals(422, json("POST", base + "/recibo", recibo).statusCode());
    recibo.put("dataProtocolo", "31/02/2025");
    assertEquals(422, json("POST", base + "/recibo", recibo).statusCode());
    recibo.put("dataProtocolo", "12/03/2025");
    assertEquals(200, json("POST", base + "/recibo", recibo).statusCode());
    assertEquals(200, json("POST", base + "/reabrir", new Acao(4, "retificação")).statusCode());
    var historico =
        body(enviar(req(base + "/historico").header("X-Siproquim-Token", TOKEN).GET().build()));
    assertFalse(historico.get(3).path("temAnexo").asBoolean(true));
    var detalhes = JSON.readTree(historico.get(3).get("alteracoes").asString());
    assertEquals("12/03/2025", detalhes.get("dataProtocolo").asString());
    assertEquals("P-ANEXO", detalhes.get("protocolo").asString());
  }

  @Test
  void reciboAnexadoMantemPdfETxtDaVersaoDepoisDeReabrir() throws Exception {
    var pedido =
        Map.of("cnpj", "11222333000181", "competencia", "2026-09", "evidencia", "Mês conferido.");
    String base =
        "/lotes/" + body(json("POST", "/lotes/sem-movimento", pedido)).at("/lote/id").asString();
    assertEquals(200, json("POST", base + "/exportar", Map.of("versao", 1)).statusCode());
    assertEquals(
        200, json("POST", base + "/processamento", new Acao(2, "retorno simulado")).statusCode());
    byte[] pdf = Files.readAllBytes(Path.of("../python/tests/frete-sintetico.pdf"));
    String url =
        base
            + "/recibo?versao=3&protocolo=TESTE-09&dataProtocolo=09%2F10%2F2026&evidencia=recibo&cnpj=11222333000181&competencia=";
    assertEquals(422, upload(url + "2026-08", "recibo.pdf", pdf).statusCode());
    assertEquals(200, upload(url + "2026-09", "recibo.pdf", pdf).statusCode());
    assertEquals(200, json("POST", base + "/reabrir", new Acao(4, "nova versão")).statusCode());
    var historico = body(enviar(req(base + "/historico").header("X-Siproquim-Token", TOKEN).GET().build()));
    assertTrue(historico.get(3).path("temAnexo").asBoolean(false));
    assertArrayEquals(
        pdf,
        enviar(req(base + "/recibo/4").header("X-Siproquim-Token", TOKEN).GET().build()).body());
  }

  @Test
  void importaCorrigeExportaAprendeRegistraProtocoloERetifica() throws Exception {
    byte[] original = Files.readAllBytes(Path.of("../python/tests/frete-sintetico.pdf"));
    String entrada = "/lotes?cnpj=11222333000181&competencia=2026-01";
    var item = upload(entrada, "teste.pdf", original);
    assertEquals(200, item.statusCode(), () -> new String(item.body(), StandardCharsets.UTF_8));
    JsonNode criado = body(item);
    String id = criado.at("/lote/id").asString(), base = "/lotes/" + id;
    assertEquals(2, criado.at("/lote/operacoes").size());
    assertEquals(id, body(upload(entrada, "reenvio.pdf", original)).at("/lote/id").asString());
    assertArrayEquals(
        original,
        enviar(req(base + "/pdf").header("X-Siproquim-Token", TOKEN).GET().build()).body());
    assertEquals(422, json("POST", base + "/exportar", Map.of("versao", 1)).statusCode());
    assertEquals(
        409,
        json("POST", base + "/recibo", new Recibo(1, "P-TESTE", "12/03/2026", "anexo de teste"))
            .statusCode());
    assertEquals(
        200,
        json(
                "PATCH",
                base + "/operacoes",
                new Correcao(1, 1, Map.of("recebedor", "NOME COMPROVADO"), "canhoto sintético"))
            .statusCode());
    assertEquals(
        409,
        json(
                "PATCH",
                base + "/operacoes",
                new Correcao(1, 1, Map.of("recebedor", "OUTRO"), "antiga"))
            .statusCode());
    assertEquals(
        200,
        json(
                "PATCH",
                base + "/operacoes",
                new Correcao(2, 2, Map.of("cte", "2", "dataCte", "10/01/2026"), "CT-e sintético"))
            .statusCode());
    var gerado = json("POST", base + "/exportar", Map.of("versao", 3));
    assertEquals(200, gerado.statusCode(), () -> new String(gerado.body(), StandardCharsets.UTF_8));
    byte[] txt = enviar(req(base + "/txt").header("X-Siproquim-Token", TOKEN).GET().build()).body();
    String[] linhas = new String(txt, StandardCharsets.UTF_8).split("\n");
    assertEquals(
        List.of("EM", "TN", "CC", "TN", "CC"),
        Arrays.stream(linhas).map(l -> l.substring(0, 2)).toList());
    assertEquals(276, linhas[1].length());
    assertEquals("NOME COMPROVADO", linhas[2].substring(31, 101).strip());
    assertEquals(
        200, json("POST", base + "/processamento", new Acao(4, "retorno de teste")).statusCode());
    assertEquals(
        0,
        body(upload("/memoria/importar?evidencia=repetida", "mapa.txt", txt))
            .get("novosVinculos")
            .asInt());
    var recibo =
        json("POST", base + "/recibo", new Recibo(5, "P-TESTE", "12/03/2026", "recibo de teste"));
    assertEquals("PROTOCOLADO", body(recibo).at("/lote/estado").asString());
    assertEquals(200, json("POST", base + "/reabrir", new Acao(6, "retificação")).statusCode());
    assertArrayEquals(
        txt,
        enviar(req(base + "/txt?versaoEnviada=6").header("X-Siproquim-Token", TOKEN).GET().build())
            .body());
    assertEquals(
        404,
        enviar(req(base + "/txt").header("X-Siproquim-Token", TOKEN).GET().build()).statusCode());
    assertEquals(
        7,
        body(enviar(req(base + "/historico").header("X-Siproquim-Token", TOKEN).GET().build()))
            .size());
  }
}
