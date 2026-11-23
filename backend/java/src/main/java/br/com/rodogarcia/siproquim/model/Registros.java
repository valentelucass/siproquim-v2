package br.com.rodogarcia.siproquim.model;

import java.util.List;
import java.util.Map;

public final class Registros {
  private Registros() {}

  public record Extraido(int pagina, Map<String, String> campos) {}

  public record Extracao(int paginas, List<Extraido> registros) {}

  public record Pendencia(int operacao, String nf, String campo, String motivo) {}

  public record Conferencia(List<Operacao> operacoes, List<Pendencia> pendencias) {}

  public record Lote(
      String id,
      String cnpj,
      String competencia,
      String nome,
      String hashPdf,
      int paginas,
      long versao,
      String estado,
      String protocolo,
      List<Operacao> operacoes) {}

  public record Resumo(
      String id, String cnpj, String competencia, String nome, long versao, String estado) {}

  public record Correcao(long versao, int operacao, Map<String, String> campos, String evidencia) {}

  public record Acao(long versao, String evidencia) {}

  public record Recibo(long versao, String protocolo, String dataProtocolo, String evidencia) {}

  public record Evento(
      long versao, String evento, String evidencia, String alteracoes, String instante, boolean temAnexo) {}

  public record Candidato(String papel, String nome, String documento) {}
}
