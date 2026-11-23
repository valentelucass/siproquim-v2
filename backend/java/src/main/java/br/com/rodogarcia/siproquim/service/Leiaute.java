package br.com.rodogarcia.siproquim.service;

import static br.com.rodogarcia.siproquim.service.Formato.*;

import br.com.rodogarcia.siproquim.model.Operacao;
import br.com.rodogarcia.siproquim.model.Registros.Candidato;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Leiaute {
  public byte[] gerar(String filial, String periodo, List<Operacao> operacoes) {
    var mes = competencia(periodo);
    List<String> linhas = new ArrayList<>();
    var anexos = new LinkedHashMap<String, List<Operacao>>();
    for (Operacao o : operacoes) {
      if (!o.valor("conhecimentoDe").isEmpty() && o.valor("duplicataDe").isEmpty())
        anexos.computeIfAbsent(o.valor("conhecimentoDe"), k -> new ArrayList<>()).add(o);
    }
    linhas.add("EM" + filial + MESES.get(mes.getMonthValue() - 1) + mes.getYear() + "00000010");
    for (Operacao o : operacoes) {
      if (!o.valor("duplicataDe").isEmpty() || !o.valor("conhecimentoDe").isEmpty()) continue;
      String tipo = Regras.tipo(o);
      if (tipo.equals("TN")) {
        linhas.add(
            "TN"
                + parte(o, "contratante")
                + campo(o.valor("nf"), 10)
                + o.valor("dataNf")
                + parte(o, "origem")
                + parte(o, "destino")
                + o.padrao("retiradaTipo", "P")
                + o.padrao("entregaTipo", "P"));
        if (!o.valor("cte").isEmpty()) linhas.add(cc(o));
        for (Operacao adicional : anexos.getOrDefault(Integer.toString(o.id()), List.of()))
          linhas.add(cc(adicional));
        terceiro(linhas, o, "retirada", "LR");
        terceiro(linhas, o, "entrega", "LE");
      } else {
        String nacional = tipo.equals("E") ? "origem" : "destino";
        String exterior = tipo.equals("E") ? "destino" : "origem";
        linhas.add(
            "TI"
                + tipo
                + Regras.ladoContratante(o)
                + campo(o.valor("nf"), 10)
                + o.valor("dataNf")
                + parte(o, nacional)
                + o.padrao("armazenamentoTipo", "P"));
        terceiro(linhas, o, "armazenamento", "LA");
        linhas.add(
            "PI"
                + campo(o.valor(exterior + "Nome"), 70)
                + o.valor("pais")
                + campo(o.valor(exterior + "Endereco"), 70));
      }
    }
    byte[] bytes = (String.join("\n", linhas) + "\n").getBytes(StandardCharsets.UTF_8);
    validar(bytes);
    return bytes;
  }

  private static String parte(Operacao o, String papel) {
    return formatarDocumento(o.valor(papel + "Doc")) + campo(o.valor(papel + "Nome"), 70);
  }

  private static String cc(Operacao o) {
    return "CC"
        + "0".repeat(9 - o.valor("cte").length())
        + o.valor("cte")
        + o.valor("dataCte")
        + o.valor("dataEntrega")
        + campo(o.valor("recebedor"), 70)
        + o.padrao("modal", "RO");
  }

  private static void terceiro(List<String> linhas, Operacao o, String local, String registro) {
    if (o.padrao(local + "Tipo", "P").equals("A"))
      linhas.add(registro + parte(o, local + "Terceiro"));
  }

  public record Importado(String filial, String competencia, List<Candidato> candidatos) {}

  public Importado validar(byte[] dados) {
    String conteudo = new String(dados, StandardCharsets.UTF_8).replace("\r\n", "\n");
    if (conteudo.endsWith("\n")) conteudo = conteudo.substring(0, conteudo.length() - 1);
    String[] ls = conteudo.split("\n", -1);
    String h = ls[0];
    if (!h.matches("EM[0-9]{14}[A-Z]{3}[0-9]{4}[01]{8}")
        || !documento(h.substring(2, 16), false)
        || !MESES.contains(h.substring(16, 19))
        || h.charAt(29) != '1') throw Falha.dados("Cabeçalho de transporte inválido.");
    String periodo =
        h.substring(19, 23)
            + "-"
            + String.format(Locale.ROOT, "%02d", MESES.indexOf(h.substring(16, 19)) + 1);
    competencia(periodo);
    List<Candidato> candidatos = new ArrayList<>();
    var esperados = new LinkedHashSet<String>();
    String pai = "";
    boolean aceitaCC = false;
    for (int i = 1; i < ls.length; i++) {
      String s = ls[i];
      String tipo = s.length() < 2 ? "" : s.substring(0, 2);
      int linha = i + 1;
      exigir(s.matches("[ -~]+") && s.equals(s.toUpperCase(Locale.ROOT)), linha);
      if (tipo.equals("TN") || tipo.equals("TI")) {
        exigir(esperados.isEmpty(), linha);
        pai = tipo;
        aceitaCC = tipo.equals("TN");
      }
      switch (tipo) {
        case "TN" -> {
          exigir(s.length() == 276, linha);
          candidato(candidatos, s, 2, "contratante", true, linha);
          exigir(nf(s.substring(86, 96)) && data(s.substring(96, 106)), linha);
          candidato(candidatos, s, 106, "origem", false, linha);
          candidato(candidatos, s, 190, "destino", true, linha);
          local(s.charAt(274), "LR", esperados, linha);
          local(s.charAt(275), "LE", esperados, linha);
        }
        case "CC" -> {
          exigir(aceitaCC && s.length() >= 103, linha);
          exigir(
              s.substring(2, 11).matches("[0-9]{9}")
                  && !s.substring(2, 11).equals("000000000")
                  && data(s.substring(11, 21))
                  && data(s.substring(21, 31))
                  && !s.substring(31, 101).isBlank()
                  && modal(s.substring(101)),
              linha);
        }
        case "LR", "LE", "LA" -> {
          exigir(!pai.isEmpty() && s.length() == 86 && esperados.remove(tipo), linha);
          candidato(
              candidatos,
              s,
              2,
              switch (tipo) {
                case "LR" -> "retiradaTerceiro";
                case "LE" -> "entregaTerceiro";
                default -> "armazenamentoTerceiro";
              },
              true,
              linha);
          aceitaCC = false;
        }
        case "TI" -> {
          exigir(s.length() == 109, linha);
          exigir(
              "EI".indexOf(s.charAt(2)) >= 0
                  && "OD".indexOf(s.charAt(3)) >= 0
                  && nf(s.substring(4, 14))
                  && data(s.substring(14, 24)),
              linha);
          candidato(candidatos, s, 24, s.charAt(2) == 'E' ? "origem" : "destino", true, linha);
          local(s.charAt(108), "LA", esperados, linha);
          esperados.add("PI");
        }
        case "PI" -> {
          exigir(
              s.length() == 145
                  && esperados.remove("PI")
                  && !s.substring(2, 72).isBlank()
                  && s.substring(72, 75).matches("[0-9]{3}")
                  && !s.substring(72, 75).equals("000")
                  && !s.substring(75).isBlank(),
              linha);
        }
        default -> exigir(false, linha);
      }
    }
    exigir(esperados.isEmpty(), ls.length);
    return new Importado(h.substring(2, 16), periodo, List.copyOf(candidatos));
  }

  private static void candidato(
      List<Candidato> out, String linha, int pos, String papel, boolean cpf, int numero) {
    String doc = linha.substring(pos, pos + 14), nome = linha.substring(pos + 14, pos + 84).strip();
    exigir(documento(doc, cpf) && doc.equals(formatarDocumento(doc)) && !nome.isBlank(), numero);
    out.add(new Candidato(papel, nome, doc.strip()));
  }

  private static boolean nf(String campo) {
    return campo.stripTrailing().matches("[A-Z0-9]{1,10}");
  }

  private static void local(char valor, String sub, Set<String> necessarios, int linha) {
    exigir(valor == 'P' || valor == 'A', linha);
    if (valor == 'A') necessarios.add(sub);
  }

  private static void exigir(boolean ok, int linha) {
    if (!ok)
      throw Falha.dados("Estrutura inválida ou subseção fiscal ausente na linha " + linha + ".");
  }
}
