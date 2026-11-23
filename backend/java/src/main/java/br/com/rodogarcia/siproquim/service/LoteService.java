package br.com.rodogarcia.siproquim.service;

import static br.com.rodogarcia.siproquim.service.Formato.*;

import br.com.rodogarcia.siproquim.model.*;
import br.com.rodogarcia.siproquim.model.Registros.*;
import br.com.rodogarcia.siproquim.repository.*;
import java.security.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoteService {
  private final LoteRepository lotes;
  private final MemoriaRepository memoria;
  private final Regras regras;
  private final Leiaute leiaute;
  private final ExtratorPdf extrator;

  public LoteService(
      LoteRepository lotes,
      MemoriaRepository memoria,
      Regras regras,
      Leiaute leiaute,
      ExtratorPdf extrator) {
    this.lotes = lotes;
    this.memoria = memoria;
    this.regras = regras;
    this.leiaute = leiaute;
    this.extrator = extrator;
  }

  public record Decisao(
      int operacao,
      String tipo,
      String situacao,
      String modal,
      String retirada,
      String entrega,
      String armazenamento,
      String contratanteInternacional) {}

  public record Resultado(Lote lote, List<Pendencia> pendencias, List<Decisao> decisoes) {}

  public record ImportacaoMemoria(String cnpj, String competencia, int novosVinculos) {}

  public Resultado consultar(String id) {
    Lote lote = lotes.obter(id);
    List<Pendencia> pendencias = regras.conferir(lote.competencia(), lote.operacoes());
    var comFalhas = new HashSet<Integer>();
    pendencias.forEach(p -> comFalhas.add(p.operacao()));
    List<Decisao> decisoes =
        lote.operacoes().stream()
            .map(
                o -> {
                  String situacao = "PRONTA";
                  if (comFalhas.contains(o.id())) situacao = "CONFERIR";
                  else if (!o.valor("duplicataDe").isEmpty()) situacao = "REPETICAO_CONFIRMADA";
                  else if (!o.valor("conhecimentoDe").isEmpty()) situacao = "CTE_VINCULADO";
                  String tipo = Regras.tipo(o);
                  return new Decisao(
                      o.id(),
                      tipo,
                      situacao,
                      o.padrao("modal", "RO"),
                      o.padrao("retiradaTipo", "P"),
                      o.padrao("entregaTipo", "P"),
                      o.padrao("armazenamentoTipo", "P"),
                      tipo.equals("TN") ? "" : Regras.ladoContratante(o));
                })
            .toList();
    return new Resultado(lote, pendencias, decisoes);
  }

  @Transactional
  public Resultado semMovimento(String filial, String periodo, String prova) {
    evidencia(prova);
    String cnpj = digitos(Objects.toString(filial, ""));
    if (!documento(cnpj, false)) throw Falha.dados("CNPJ da filial inválido.");
    competencia(periodo);
    if (lotes.possuiFretes(cnpj, periodo))
      throw Falha.conflito("Já há um PDF de fretes para esta filial e competência.");
    String id = lotes.criar(cnpj, periodo, "SEM-MOVIMENTO", prova, 0, List.of(), new byte[0]);
    return consultar(id);
  }

  public Resultado importar(String filial, String periodo, String nome, byte[] pdf) {
    String cnpj = digitos(filial);
    if (!documento(cnpj, false)) throw Falha.dados("CNPJ da filial inválido.");
    competencia(periodo);
    String hash = hash(pdf);
    String id =
        lotes
            .existente(cnpj, periodo, hash)
            .orElseGet(
                () -> {
                  Extracao leitura = extrator.extrair(pdf);
                  return lotes.criar(
                      cnpj, periodo, hash, nome, leitura.paginas(), regras.agrupar(leitura), pdf);
                });
    return consultar(id);
  }

  @Transactional
  public Resultado corrigir(String id, Correcao r) {
    Lote lote = editar(id, r.versao(), "CONFERENCIA", "EXPORTADO");
    evidencia(r.evidencia());
    if (r.campos() == null
        || r.campos().isEmpty()
        || !Regras.EDITAVEIS.containsAll(r.campos().keySet()))
      throw Falha.dados("A correção contém campo desconhecido ou nenhuma alteração.");
    if (r.campos().values().stream()
        .anyMatch(
            v -> v == null || v.length() > 500 || v.chars().anyMatch(Character::isISOControl)))
      throw Falha.dados("Valor de correção inválido.");
    var ops = new ArrayList<>(lote.operacoes());
    int i = r.operacao() - 1;
    if (i < 0 || i >= ops.size()) throw Falha.dados("Operação inexistente neste lote.");
    Operacao anterior = ops.get(i);
    var antes = new TreeMap<String, String>();
    r.campos().keySet().forEach(k -> antes.put(k, anterior.valor(k)));
    ops.set(i, anterior.corrigir(r.campos()));
    lotes.mudar(
        lote,
        "CONFERENCIA",
        ops,
        null,
        null,
        "CORRIGIDO",
        r.evidencia(),
        Map.of("operacao", r.operacao(), "antes", antes, "depois", r.campos()));
    return consultar(id);
  }

  @Transactional
  public Resultado exportar(String id, long versao) {
    Lote l = editar(id, versao, "CONFERENCIA", "EXPORTADO");
    if (l.paginas() == 0 && lotes.possuiFretes(l.cnpj(), l.competencia()))
      throw Falha.conflito("Existe um lote com fretes nesta competência.");
    if (l.estado().equals("EXPORTADO")) return consultar(id);
    byte[] bytes = gerarValidado(l);
    lotes.mudar(
        l, "EXPORTADO", l.operacoes(), bytes, null, "EXPORTADO",
        "Validação local", Map.of("sha256", hash(bytes)));
    byte[] salvo = lotes.arquivo(id, false);
    if (!Arrays.equals(bytes, salvo))
      throw new IllegalStateException("Arquivo gravado diverge do gerado.");
    leiaute.validar(salvo);
    return consultar(id);
  }

  public byte[] previa(String id) {
    Lote lote = lotes.obter(id);
    if (lote.paginas() == 0 && lotes.possuiFretes(lote.cnpj(), lote.competencia()))
      throw Falha.conflito("Existe um lote com fretes nesta competência.");
    return gerarValidado(lote);
  }

  private byte[] gerarValidado(Lote l) {
    var falhas = regras.conferir(l.competencia(), l.operacoes());
    if (!falhas.isEmpty())
      throw new Falha(
          org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
          "Confira as pendências do lote.",
          falhas);
    return leiaute.gerar(l.cnpj(), l.competencia(), l.operacoes());
  }

  @Transactional
  public Resultado processado(String id, Acao acao) {
    Lote l = editar(id, acao.versao(), "EXPORTADO");
    evidencia(acao.evidencia());
    if (l.paginas() == 0 && lotes.possuiFretes(l.cnpj(), l.competencia()))
      throw Falha.conflito("Existe um lote com fretes nesta competência.");
    byte[] txt = lotes.arquivo(id, false);
    var dados = leiaute.validar(txt);
    memoria.aprender(l.cnpj(), dados.candidatos(), hash(txt), acao.evidencia());
    lotes.mudar(
        l,
        "PROCESSADO",
        l.operacoes(),
        txt,
        null,
        "PROCESSAMENTO_INFORMADO",
        acao.evidencia(),
        Map.of("sha256", hash(txt)));
    return consultar(id);
  }

  @Transactional
  public Resultado registrarRecibo(String id, Recibo r) {
    Lote l = editar(id, r.versao(), "PROCESSADO");
    if (l.paginas() == 0 && lotes.possuiFretes(l.cnpj(), l.competencia()))
      throw Falha.conflito("Existe um lote com fretes nesta competência.");
    evidencia(r.evidencia());
    if (r.protocolo() == null
        || r.protocolo().isBlank()
        || r.protocolo().length() > 120
        || r.protocolo().chars().anyMatch(Character::isISOControl))
      throw Falha.dados("Informe o número do protocolo do recibo da PF.");
    if (r.dataProtocolo() == null || !data(r.dataProtocolo()))
      throw Falha.dados(
          "Informe a data do protocolo que consta no recibo da PF, no formato dd/mm/aaaa.");
    byte[] txt = lotes.arquivo(id, false);
    lotes.arquivar(id, l.versao() + 1, r.protocolo().strip(), txt);
    lotes.mudar(
        l,
        "PROTOCOLADO",
        l.operacoes(),
        txt,
        r.protocolo().strip(),
        "RECIBO_INFORMADO",
        r.evidencia(),
        Map.of("protocolo", r.protocolo().strip(), "dataProtocolo", r.dataProtocolo()));
    return consultar(id);
  }

  @Transactional
  public Resultado anexarRecibo(String id, Recibo r, String filial, String periodo, byte[] pdf) {
    Lote l = editar(id, r.versao(), "PROCESSADO");
    if (!l.cnpj().equals(digitos(filial)) || !l.competencia().equals(periodo))
      throw Falha.dados("A filial e competência informadas no recibo devem corresponder ao lote.");
    if (pdf.length < 5
        || !new String(pdf, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))
      throw Falha.dados("O comprovante anexado precisa ser um PDF.");
    Resultado resultado = registrarRecibo(id, r);
    lotes.anexarRecibo(id, resultado.lote().versao(), pdf);
    return resultado;
  }

  @Transactional
  public Resultado reabrir(String id, Acao r) {
    Lote l = editar(id, r.versao(), "PROCESSADO", "PROTOCOLADO");
    evidencia(r.evidencia());
    lotes.mudar(
        l,
        "CONFERENCIA",
        l.operacoes(),
        null,
        null,
        "REABERTO",
        r.evidencia(),
        Map.of("anterior", l.estado(), "protocoloAnterior", Objects.toString(l.protocolo(), "")));
    return consultar(id);
  }

  public ImportacaoMemoria aprender(byte[] txt, String evidencia) {
    evidencia(evidencia);
    var dado = leiaute.validar(txt);
    int n = memoria.aprender(dado.filial(), dado.candidatos(), hash(txt), evidencia);
    return new ImportacaoMemoria(dado.filial(), dado.competencia(), n);
  }

  private Lote editar(String id, long versao, String... estados) {
    Lote l = lotes.obter(id);
    if (versao != l.versao()) throw Falha.conflito("A versão do lote mudou. Recarregue os dados.");
    if (!List.of(estados).contains(l.estado()))
      throw Falha.conflito("Ação incompatível com o estado " + l.estado() + ".");
    return l;
  }

  private static void evidencia(String s) {
    if (s == null || s.isBlank() || s.length() > 1000)
      throw Falha.dados("Informe a referência da evidência, com até 1000 caracteres.");
  }

  public static String hash(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
