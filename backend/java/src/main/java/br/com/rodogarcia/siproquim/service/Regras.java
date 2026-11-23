package br.com.rodogarcia.siproquim.service;

import static br.com.rodogarcia.siproquim.service.Formato.*;

import br.com.rodogarcia.siproquim.model.Operacao;
import br.com.rodogarcia.siproquim.model.Registros.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class Regras {
  public static final Set<String> EDITAVEIS;

  static {
    var campos =
        new HashSet<>(
            List.of(
                "nf",
                "dataNf",
                "cte",
                "dataCte",
                "dataEntrega",
                "recebedor",
                "modal",
                "tipo",
                "contratanteInternacional",
                "pais",
                "retiradaTipo",
                "entregaTipo",
                "armazenamentoTipo",
                "retiradaCidade",
                "entregaCidade",
                "municipalConfirmado",
                "prestacaoConfirmada",
                "duplicataDe",
                "conhecimentoDe",
                "competenciaConfirmada"));
    for (String papel :
        List.of(
            "origem",
            "destino",
            "contratante",
            "retiradaTerceiro",
            "entregaTerceiro",
            "armazenamentoTerceiro"))
      for (String atributo : List.of("Nome", "Doc", "Cidade", "Endereco"))
        campos.add(papel + atributo);
    EDITAVEIS = Set.copyOf(campos);
  }

  public List<Operacao> agrupar(Extracao extracao) {
    if (extracao.paginas() < 1 || extracao.registros().isEmpty())
      throw Falha.dados("PDF sem operações.");
    var grupos = new LinkedHashMap<Map<String, String>, LinkedHashSet<Integer>>();
    for (Extraido r : extracao.registros()) {
      if (r.pagina() < 1 || r.pagina() > extracao.paginas())
        throw Falha.dados("Página de origem inválida.");
      grupos.computeIfAbsent(r.campos(), k -> new LinkedHashSet<>()).add(r.pagina());
    }
    var saida = new ArrayList<Operacao>();
    grupos.forEach(
        (campos, paginas) ->
            saida.add(new Operacao(saida.size() + 1, List.copyOf(paginas), campos, Map.of())));
    return List.copyOf(saida);
  }

  static String tipo(Operacao op) {
    if (op.ajustes().containsKey("tipo")) return op.valor("tipo");
    boolean exteriorOrigem = exterior(op.valor("origemCidade"));
    boolean exteriorDestino = exterior(op.valor("destinoCidade"));
    if (exteriorOrigem && exteriorDestino) return "";
    if (exteriorOrigem) return "I";
    return exteriorDestino ? "E" : "TN";
  }

  static boolean exterior(String cidade) {
    String s = texto(cidade);
    return s.equals("EXTERIOR") || s.matches(".*\\s[-/]\\s*EX");
  }

  static String ladoContratante(Operacao op) {
    if (op.ajustes().containsKey("contratanteInternacional"))
      return op.valor("contratanteInternacional");
    String doc = digitos(op.valor("contratanteDoc"));
    if (!doc.isBlank() && doc.equals(digitos(op.valor("origemDoc")))) return "O";
    if (!doc.isBlank() && doc.equals(digitos(op.valor("destinoDoc")))) return "D";
    return "";
  }

  public List<Pendencia> conferir(String periodo, List<Operacao> ops) {
    return avaliar(periodo, ops).pendencias();
  }

  public record Avaliacao(List<Pendencia> pendencias, Map<Integer, Set<String>> camposAvaliados) {}

  public Avaliacao avaliar(String periodo, List<Operacao> ops) {
    competencia(periodo);
    var pendencias = new ArrayList<Pendencia>();
    var camposAvaliados = new HashMap<Integer, Set<String>>();
    var indices = new HashMap<String, Operacao>();
    var ocorrencias = new HashMap<List<String>, Integer>();
    var conhecimentos = new HashSet<List<String>>();
    for (Operacao o : ops) {
      indices.put(Integer.toString(o.id()), o);
      if (o.valor("duplicataDe").isEmpty() && o.valor("conhecimentoDe").isEmpty()) {
        ocorrencias.merge(chaveNota(o), 1, Integer::sum);
        conhecimentos.add(
            List.of(Integer.toString(o.id()), o.valor("cte").replaceFirst("^0+", "")));
      }
    }
    for (Operacao o : ops) {
      var campos = new LinkedHashSet<String>();
      camposAvaliados.put(o.id(), campos);
      var c = new Checagem(o, pendencias, campos);
      if (!o.valor("duplicataDe").isEmpty()) {
        Operacao alvo = indices.get(o.valor("duplicataDe"));
        c.exigir(
            alvo != null
                && alvo.id() != o.id()
                && alvo.valor("duplicataDe").isEmpty()
                && o.valor("conhecimentoDe").isEmpty()
                && chaveNota(o).equals(chaveNota(alvo)),
            "duplicataDe",
            "Indique outra ocorrência ativa da mesma nota e emitente.");
        continue;
      }
      String pai = o.valor("conhecimentoDe");
      if (pai.isEmpty()) {
        c.exigir(
            ocorrencias.get(chaveNota(o)) == 1 || o.valor("prestacaoConfirmada").equals("SIM"),
            "prestacaoConfirmada",
            "Há prestações com dados diferentes para a mesma nota. Confira cada ocorrência.");
      } else {
        Operacao alvo = indices.get(pai);
        boolean vinculo =
            alvo != null
                && alvo.id() != o.id()
                && alvo.valor("duplicataDe").isEmpty()
                && alvo.valor("conhecimentoDe").isEmpty()
                && tipo(alvo).equals("TN")
                && tipo(o).equals("TN")
                && chaveNota(o).equals(chaveNota(alvo))
                && mesmoTransporte(o, alvo)
                && !o.valor("cte").isEmpty()
                && !alvo.valor("cte").isEmpty();
        c.exigir(
            vinculo && conhecimentos.add(List.of(pai, o.valor("cte").replaceFirst("^0+", ""))),
            "conhecimentoDe",
            "Vincule um CT-e distinto a uma operação nacional com os mesmos dados da prestação.");
      }
      c.exigir(
          o.valor("nf").matches("[A-Za-z0-9]{1,10}"),
          "nf",
          "Informe o número da nota com até dez posições.");
      c.exigir(data(o.valor("dataNf")), "dataNf", "Data da nota inválida.");
      if (data(o.valor("dataNf"))) {
        String d = o.valor("dataNf");
        c.exigir(
            periodo.equals(d.substring(6) + "-" + d.substring(3, 5))
                || o.valor("competenciaConfirmada").equals("SIM"),
            "competenciaConfirmada",
            "A nota foi emitida fora da competência selecionada. Confira o mês da operação.");
      }
      switch (tipo(o)) {
        case "TN" -> nacional(c);
        case "E", "I" -> internacional(c);
        default ->
            c.exigir(false, "tipo", "Confirme se a operação é nacional, importação ou exportação.");
      }
    }
    return new Avaliacao(List.copyOf(pendencias), Map.copyOf(camposAvaliados));
  }

  private static List<String> chaveNota(Operacao o) {
    return List.of(o.valor("nf"), digitos(o.valor("origemDoc")), o.valor("dataNf"));
  }

  private static boolean mesmoTransporte(Operacao a, Operacao b) {
    for (String f :
        List.of(
            "origemDoc",
            "origemNome",
            "destinoDoc",
            "destinoNome",
            "contratanteDoc",
            "contratanteNome",
            "origemCidade",
            "destinoCidade",
            "retiradaCidade",
            "entregaCidade",
            "retiradaTerceiroDoc",
            "retiradaTerceiroNome",
            "entregaTerceiroDoc",
            "entregaTerceiroNome")) {
      if (!texto(a.valor(f)).equals(texto(b.valor(f)))) return false;
    }
    return a.padrao("retiradaTipo", "P").equals(b.padrao("retiradaTipo", "P"))
        && a.padrao("entregaTipo", "P").equals(b.padrao("entregaTipo", "P"));
  }

  private void nacional(Checagem c) {
    Operacao o = c.op;
    c.parte("origem", false);
    c.parte("destino", true);
    c.parte("contratante", true);
    c.local("retirada");
    c.local("entrega");
    boolean semNumero = o.valor("cte").isBlank(), semData = o.valor("dataCte").isBlank();
    if (semNumero && semData) {
      String de = localEfetivo(o, "retirada", "origem");
      String para = localEfetivo(o, "entrega", "destino");
      if (de.isEmpty() || para.isEmpty())
        c.exigir(
            false,
            "retiradaCidade",
            "Confira os municípios e UFs efetivos da retirada e da entrega.");
      else if (!de.equals(para))
        c.exigir(
            false, "cte", "Transporte entre municípios ou estados exige conhecimento de carga.");
      else
        c.exigir(
            o.valor("municipalConfirmado").equals("SIM"),
            "municipalConfirmado",
            "Confirme a prestação dentro do mesmo município.");
      return;
    }
    c.exigir(
        o.valor("cte").matches("[0-9]{1,9}") && !o.valor("cte").matches("0+"),
        "cte",
        "Número do CT-e ausente ou inválido.");
    c.exigir(data(o.valor("dataCte")), "dataCte", "Confira a data de emissão do CT-e.");
    c.exigir(data(o.valor("dataEntrega")), "dataEntrega", "Confira a data de recebimento.");
    c.exigir(recebedor(o.valor("recebedor")), "recebedor", "Conferir comprovante de entrega.");
    c.exigir(modal(o.padrao("modal", "RO")), "modal", "Informe os modais RO, AQ, FE ou AE.");
  }

  private String localEfetivo(Operacao o, String local, String papel) {
    String cidadeDoLocal =
        o.padrao(local + "Tipo", "P").equals("A")
            ? o.valor(local + "TerceiroCidade")
            : o.valor(papel + "Cidade");
    return municipio(o.padrao(local + "Cidade", cidadeDoLocal));
  }

  private void internacional(Checagem c) {
    Operacao o = c.op;
    boolean exportacao = tipo(o).equals("E");
    String brasileira = exportacao ? "origem" : "destino",
        estrangeira = exportacao ? "destino" : "origem";
    c.parte(brasileira, true);
    c.nome(estrangeira + "Nome");
    c.nome(estrangeira + "Endereco");
    c.exigir(
        Set.of("O", "D").contains(ladoContratante(o)),
        "contratanteInternacional",
        "Identifique se o contratante é a origem ou o destino.");
    c.exigir(
        o.valor("pais").matches("[0-9]{3}") && !o.valor("pais").equals("000"),
        "pais",
        "Informe o identificador de três dígitos da tabela de países da PF.");
    c.local("armazenamento");
  }

  private record Checagem(Operacao op, List<Pendencia> falhas, Set<String> camposAvaliados) {
    void exigir(boolean ok, String campo, String motivo) {
      camposAvaliados.add(campo);
      if (!ok) falhas.add(new Pendencia(op.id(), op.valor("nf"), campo, motivo));
    }

    void nome(String campo) {
      exigir(imprimivel(op.valor(campo)), campo, "Confira o texto no documento de origem.");
    }

    void parte(String papel, boolean cpf) {
      String campo = papel + "Doc";
      exigir(
          documento(op.valor(campo), cpf),
          campo,
          "Confira o documento original e os dígitos de controle. Preserve letras para revisão.");
      nome(papel + "Nome");
    }

    void local(String prefixo) {
      String local = op.padrao(prefixo + "Tipo", "P");
      exigir(
          Set.of("P", "A").contains(local),
          prefixo + "Tipo",
          "Escolha próprio (P) ou armazenagem terceirizada (A).");
      if (local.equals("A")) parte(prefixo + "Terceiro", true);
    }
  }
}
