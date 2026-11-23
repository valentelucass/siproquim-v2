package br.com.rodogarcia.siproquim;

import static org.junit.jupiter.api.Assertions.*;

import br.com.rodogarcia.siproquim.model.*;
import br.com.rodogarcia.siproquim.model.Registros.*;
import br.com.rodogarcia.siproquim.service.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class RegrasTest {
  final Regras regras = new Regras();
  final Leiaute leiaute = new Leiaute();
  static final String FILIAL = "11222333000181", PERIODO = "2026-02";

  Operacao exemplo() {
    Map<String, String> campos =
        new HashMap<>(
            Map.of(
                "nf",
                "21",
                "dataNf",
                "02/02/2026",
                "cte",
                "12",
                "dataCte",
                "02/02/2026",
                "dataEntrega",
                "03/02/2026",
                "recebedor",
                "José dos Testes",
                "origemCidade",
                "Curitiba - PR",
                "destinoCidade",
                "São Paulo - SP"));
    for (String p : List.of("origem", "contratante", "destino")) {
      campos.put(p + "Doc", FILIAL);
      campos.put(p + "Nome", "EMPRESA " + p);
    }
    return new Operacao(1, List.of(1), campos, Map.of());
  }

  Set<String> problemas(Operacao op) {
    Set<String> campos = new HashSet<>();
    regras.conferir(PERIODO, List.of(op)).forEach(p -> campos.add(p.campo()));
    return campos;
  }

  @Test
  void cpfComZeroOriginalMantemOnzeDigitosETresEspacos() {
    // CPF de teste calculado sobre a base fictícia 012345678.
    Operacao op = exemplo().corrigir(Map.of("destinoDoc", "012.345.678-90"));
    assertEquals(Set.of(), problemas(op));
    String txt = new String(leiaute.gerar(FILIAL, PERIODO, List.of(op)), StandardCharsets.UTF_8);
    String[] ls = txt.split("\n");
    assertEquals("   01234567890", ls[1].substring(190, 204));
    assertEquals(31, ls[0].length());
    assertEquals(276, ls[1].length());
    assertEquals(103, ls[2].length());
    assertTrue(ls[2].contains("JOSE DOS TESTES"));
    assertThrows(
        Falha.class,
        () ->
            leiaute.validar(
                txt.replace("   01234567890", "00001234567890").getBytes(StandardCharsets.UTF_8)));
  }

  @ParameterizedTest
  @ValueSource(strings = {"CARIMBO", "ASSINATURA", "ASSINADO E CARIMBADO", "RUBRICA", "-", ""})
  void exigeIdentificacaoDoRecebedor(String texto) {
    assertTrue(problemas(exemplo().corrigir(Map.of("recebedor", texto))).contains("recebedor"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"AB.222.333/0001-81", "01234567890123", "11111111111111", ""})
  void documentoInvalidoNaoEhReconstruido(String texto) {
    assertTrue(problemas(exemplo().corrigir(Map.of("destinoDoc", texto))).contains("destinoDoc"));
  }

  @ParameterizedTest
  @CsvSource({
    "Campinas - SP,Sumaré - SP,cte",
    "CURITIBA - PR,JOAO MONLEVADE - MG,cte",
    "DESCONHECIDO,São Paulo - SP,retiradaCidade",
    "SUMARE - SP,Sumaré - SP,municipalConfirmado"
  })
  void trajetoSemConhecimento(String origem, String destino, String problema) {
    var op =
        exemplo()
            .corrigir(
                Map.of("cte", "", "dataCte", "", "origemCidade", origem, "destinoCidade", destino));
    assertEquals(Set.of(problema), problemas(op));
    if (problema.equals("municipalConfirmado")) {
      op = op.corrigir(Map.of("municipalConfirmado", "SIM"));
      assertEquals(Set.of(), problemas(op));
      assertEquals(
          2,
          new String(leiaute.gerar(FILIAL, PERIODO, List.of(op)), StandardCharsets.UTF_8)
              .lines()
              .count());
    }
  }

  @ParameterizedTest
  @CsvSource({"I,origem,destino", "E,destino,origem"})
  void sentidoInternacionalEArmazenagem(String tipo, String exterior, String brasil) {
    var op =
        exemplo()
            .corrigir(
                Map.of(
                    "tipo",
                    tipo,
                    "pais",
                    "056",
                    exterior + "Doc",
                    "",
                    exterior + "Endereco",
                    "RUA EXTERIOR",
                    "armazenamentoTipo",
                    "A",
                    "armazenamentoTerceiroDoc",
                    FILIAL,
                    "armazenamentoTerceiroNome",
                    "ARMAZEM",
                    "contratanteInternacional",
                    "D"));
    assertEquals(Set.of(), problemas(op));
    var linhas =
        new String(leiaute.gerar(FILIAL, PERIODO, List.of(op)), StandardCharsets.UTF_8)
            .lines()
            .toList();
    assertEquals(
        List.of("EM", "TI", "LA", "PI"), linhas.stream().map(x -> x.substring(0, 2)).toList());
    assertEquals(
        op.valor(brasil + "Nome").toUpperCase(Locale.ROOT),
        linhas.get(1).substring(38, 108).strip());
    assertEquals(
        op.valor(exterior + "Nome").toUpperCase(Locale.ROOT),
        linhas.get(3).substring(2, 72).strip());
    assertEquals("056", linhas.get(3).substring(72, 75));
    for (int i : List.of(2, 3)) {
      var invalidas = new ArrayList<>(linhas);
      invalidas.remove(i);
      assertThrows(
          Falha.class,
          () -> leiaute.validar(String.join("\n", invalidas).getBytes(StandardCharsets.UTF_8)));
    }
  }

  @Test
  void locaisTerceirizadosEMultimodalPreservamDependencias() {
    var op =
        exemplo()
            .corrigir(
                Map.of(
                    "retiradaTipo",
                    "A",
                    "entregaTipo",
                    "A",
                    "retiradaTerceiroDoc",
                    FILIAL,
                    "retiradaTerceiroNome",
                    "RETIRADA",
                    "entregaTerceiroDoc",
                    FILIAL,
                    "entregaTerceiroNome",
                    "ENTREGA",
                    "modal",
                    "ROAE"));
    assertEquals(Set.of(), problemas(op));
    var linhas =
        new String(leiaute.gerar(FILIAL, PERIODO, List.of(op)), StandardCharsets.UTF_8)
            .lines()
            .toList();
    assertEquals(
        List.of("EM", "TN", "CC", "LR", "LE"),
        linhas.stream().map(x -> x.substring(0, 2)).toList());
    assertEquals("ROAE", linhas.get(2).substring(101));
    assertTrue(
        problemas(op.corrigir(Map.of("retiradaTerceiroDoc", ""))).contains("retiradaTerceiroDoc"));
    assertTrue(problemas(op.corrigir(Map.of("modal", "RORO"))).contains("modal"));
  }

  @Test
  void deduplicaApenasRepeticoesIdenticasComTodasAsPaginas() {
    var m = exemplo().original();
    var diferente = new HashMap<>(m);
    diferente.put("cte", "99");
    var ops =
        regras.agrupar(
            new Extracao(
                3, List.of(new Extraido(1, m), new Extraido(2, m), new Extraido(3, diferente))));
    assertEquals(2, ops.size());
    assertEquals(List.of(1, 2), ops.getFirst().paginas());
    assertEquals(
        2,
        regras.conferir(PERIODO, ops).stream()
            .filter(p -> p.campo().equals("prestacaoConfirmada"))
            .count());
  }

  @Test
  void localTerceiroExigeCidadeEfetivaParaDispensarConhecimento() {
    var op =
        exemplo()
            .corrigir(
                Map.of(
                    "origemCidade",
                    "CURITIBA - PR",
                    "destinoCidade",
                    "CURITIBA - PR",
                    "cte",
                    "",
                    "dataCte",
                    "",
                    "retiradaTipo",
                    "A",
                    "retiradaTerceiroDoc",
                    FILIAL,
                    "retiradaTerceiroNome",
                    "ARMAZEM",
                    "municipalConfirmado",
                    "SIM"));
    assertTrue(problemas(op).contains("retiradaCidade"));
    assertEquals(Set.of(), problemas(op.corrigir(Map.of("retiradaCidade", "CURITIBA - PR"))));
    assertTrue(problemas(op.corrigir(Map.of("retiradaCidade", "CASCAVEL - PR"))).contains("cte"));
  }

  @Test
  void documentoNacionalAusenteNaoViraTransporteInternacional() {
    var op = exemplo().corrigir(Map.of("destinoDoc", ""));
    assertEquals(Set.of("destinoDoc"), problemas(op));
  }

  @Test
  void municipiosSemNomeNuncaConfirmamPrestacaoMunicipal() {
    var op =
        exemplo()
            .corrigir(
                Map.of(
                    "origemCidade",
                    "NÃO INFORMADO - SP",
                    "destinoCidade",
                    "NÃO INFORMADO - SP",
                    "cte",
                    "",
                    "dataCte",
                    "",
                    "municipalConfirmado",
                    "SIM"));
    assertTrue(problemas(op).contains("retiradaCidade"));
  }

  @Test
  void doisConhecimentosDaMesmaOperacaoSaoExportadosSobUmaNota() {
    var original = exemplo();
    var segundo =
        new Operacao(
            2, List.of(2), original.original(), Map.of("cte", "13", "conhecimentoDe", "1"));
    assertTrue(regras.conferir(PERIODO, List.of(original, segundo)).isEmpty());
    var linhas =
        new String(
                leiaute.gerar(FILIAL, PERIODO, List.of(original, segundo)), StandardCharsets.UTF_8)
            .lines()
            .toList();
    assertEquals(
        List.of("EM", "TN", "CC", "CC"), linhas.stream().map(x -> x.substring(0, 2)).toList());
    assertEquals("000000013", linhas.getLast().substring(2, 11));
    assertFalse(
        regras
            .conferir(
                PERIODO, List.of(original, segundo.corrigir(Map.of("contratanteNome", "OUTRO"))))
            .isEmpty());
    assertFalse(
        regras
            .conferir(PERIODO, List.of(original, segundo.corrigir(Map.of("cte", "12"))))
            .isEmpty());
  }
}
