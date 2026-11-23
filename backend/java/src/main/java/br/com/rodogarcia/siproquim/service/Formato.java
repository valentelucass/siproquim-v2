package br.com.rodogarcia.siproquim.service;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.*;
import java.util.*;
import java.util.regex.Pattern;

public final class Formato {
  private Formato() {}

  public static final List<String> MESES =
      List.of("JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ");
  private static final DateTimeFormatter DATA =
      DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT);
  private static final Pattern MARCAS = Pattern.compile("\\p{M}+");

  public static String texto(String raw) {
    String s = Normalizer.normalize(raw, Normalizer.Form.NFKD).toUpperCase(Locale.ROOT);
    return MARCAS
        .matcher(s)
        .replaceAll("")
        .replace('–', '-')
        .replace('—', '-')
        .replace('’', '\'')
        .replace('“', '"')
        .replace('”', '"')
        .replaceAll("\\s+", " ")
        .strip();
  }

  public static boolean imprimivel(String s) {
    return texto(s).matches("[ -~]+");
  }

  public static String campo(String valor, int largura) {
    String s = texto(valor);
    if (s.length() > largura) s = s.substring(0, largura);
    return s + " ".repeat(largura - s.length());
  }

  public static String digitos(String s) {
    return s.replaceAll("[./\\s-]", "");
  }

  public static boolean documento(String valor, boolean aceitaCpf) {
    String d = digitos(valor);
    if (!d.matches("[0-9]{14}") && !(aceitaCpf && d.matches("[0-9]{11}"))) return false;
    if (d.chars().distinct().count() == 1) return false;
    for (int i = d.length() - 2; i < d.length(); i++) {
      int soma = 0;
      for (int j = 0; j < i; j++) {
        int peso = d.length() == 11 ? i + 1 - j : 2 + (i - 1 - j) % 8;
        soma += (d.charAt(j) - '0') * peso;
      }
      int resto = soma % 11;
      if (d.charAt(i) - '0' != (resto < 2 ? 0 : 11 - resto)) return false;
    }
    return true;
  }

  public static String formatarDocumento(String raw) {
    String d = digitos(raw);
    return " ".repeat(14 - d.length()) + d;
  }

  public static boolean data(String s) {
    try {
      LocalDate.parse(s, DATA);
      return s.length() == 10;
    } catch (DateTimeParseException e) {
      return false;
    }
  }

  public static YearMonth competencia(String s) {
    try {
      YearMonth mes = YearMonth.parse(s);
      if (!s.matches("[0-9]{4}-[0-9]{2}") || mes.getYear() < 2010)
        throw new IllegalArgumentException();
      return mes;
    } catch (RuntimeException e) {
      throw Falha.dados("Informe a competência no formato AAAA-MM, a partir de 2010.");
    }
  }

  public static boolean modal(String s) {
    if (!s.matches("(?:RO|AQ|AE|FE){1,4}")) return false;
    var vistos = new HashSet<String>();
    for (int i = 0; i < s.length(); i += 2) if (!vistos.add(s.substring(i, i + 2))) return false;
    return true;
  }

  public static String municipio(String s) {
    String cidade = texto(s).replaceAll("\\s*[-/]\\s*", "-");
    if (cidade.matches(
        "(NAO INFORMAD[OA]|IGNORAD[OA]|DESCONHECID[OA]|INDEFINID[OA]|SEM INFORMACAO|EXTERIOR)-.*"))
      return "";
    return cidade.matches(
            ".+-(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)")
        ? cidade
        : "";
  }

  public static boolean recebedor(String s) {
    String nome = texto(s);
    return imprimivel(s)
        && nome.matches(".*[A-Z].*[A-Z].*")
        && nome.length() >= 3
        && !nome.matches(
            ".*\\b(CARIMBO|CARIMBADO|ASSINATURA|ASSINADO|RUBRICA|ILEGIVEL|INDEFINIDO)\\b.*")
        && !Set.of("ASS", "NAO INFORMADO", "SEM NOME", "NAO CONSTA").contains(nome);
  }
}
