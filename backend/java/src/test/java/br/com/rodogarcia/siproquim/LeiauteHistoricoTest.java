package br.com.rodogarcia.siproquim;

import static org.junit.jupiter.api.Assertions.*;

import br.com.rodogarcia.siproquim.model.Operacao;
import br.com.rodogarcia.siproquim.service.Leiaute;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Confere fidelidade do serializador separadamente da suficiência dos comprovantes. */
@EnabledIfEnvironmentVariable(named = "SIPROQUIM_HISTORICO", matches = ".+")
class LeiauteHistoricoTest {
  @ParameterizedTest
  @ValueSource(strings = {"00000154", "00000270", "00000373"})
  void camposHistoricosConfirmadosReconstroemTodosOsBytes(String prefixo) throws Exception {
    Path dir = Path.of(System.getenv("SIPROQUIM_HISTORICO"));
    byte[] bytes;
    try (var arquivos = Files.list(dir)) {
      bytes =
          Files.readAllBytes(
              arquivos
                  .filter(p -> p.getFileName().toString().startsWith(prefixo))
                  .findFirst()
                  .orElseThrow());
    }
    Leiaute leiaute = new Leiaute();
    var cabecalho = leiaute.validar(bytes);
    var campos = new ArrayList<Map<String, String>>();
    Map<String, String> atual = null;
    for (String linha : new String(bytes, StandardCharsets.UTF_8).lines().toList()) {
      switch (linha.substring(0, 2)) {
        case "EM" -> {}
        case "TN" -> {
          atual = new HashMap<>();
          campos.add(atual);
          parte(atual, "contratante", linha, 2);
          atual.put("nf", linha.substring(86, 96).strip());
          atual.put("dataNf", linha.substring(96, 106));
          parte(atual, "origem", linha, 106);
          parte(atual, "destino", linha, 190);
          atual.put("retiradaTipo", linha.substring(274, 275));
          atual.put("entregaTipo", linha.substring(275));
        }
        case "CC" -> {
          assertNotNull(atual);
          atual.put("cte", linha.substring(2, 11));
          atual.put("dataCte", linha.substring(11, 21));
          atual.put("dataEntrega", linha.substring(21, 31));
          atual.put("recebedor", linha.substring(31, 101).strip());
          atual.put("modal", linha.substring(101));
        }
        case "TI" -> {
          atual = new HashMap<>();
          campos.add(atual);
          atual.put("tipo", linha.substring(2, 3));
          atual.put("contratanteInternacional", linha.substring(3, 4));
          atual.put("nf", linha.substring(4, 14).strip());
          atual.put("dataNf", linha.substring(14, 24));
          parte(atual, linha.charAt(2) == 'E' ? "origem" : "destino", linha, 24);
          atual.put("armazenamentoTipo", linha.substring(108));
        }
        case "PI" -> {
          assertNotNull(atual);
          String papel = atual.get("tipo").equals("E") ? "destino" : "origem";
          atual.put(papel + "Nome", linha.substring(2, 72).strip());
          atual.put("pais", linha.substring(72, 75));
          atual.put(papel + "Endereco", linha.substring(75).strip());
        }
        default -> fail("Tipo inesperado nesta amostra.");
      }
    }
    var ops = new ArrayList<Operacao>();
    for (var c : campos) ops.add(new Operacao(ops.size() + 1, List.of(1), Map.of(), c));
    assertArrayEquals(bytes, leiaute.gerar(cabecalho.filial(), cabecalho.competencia(), ops));
  }

  private void parte(Map<String, String> m, String papel, String s, int p) {
    m.put(papel + "Doc", s.substring(p, p + 14).strip());
    m.put(papel + "Nome", s.substring(p + 14, p + 84).strip());
  }
}
