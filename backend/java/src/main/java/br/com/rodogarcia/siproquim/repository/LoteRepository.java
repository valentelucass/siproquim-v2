package br.com.rodogarcia.siproquim.repository;

import br.com.rodogarcia.siproquim.model.Operacao;
import br.com.rodogarcia.siproquim.model.Registros.*;
import br.com.rodogarcia.siproquim.service.Falha;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class LoteRepository {
  private final JdbcTemplate db;
  private final JsonMapper json;
  private static final TypeReference<List<Operacao>> OPERACOES = new TypeReference<>() {};

  public LoteRepository(JdbcTemplate db, JsonMapper json) {
    this.db = db;
    this.json = json;
  }

  private static Falha ausente() {
    return new Falha(HttpStatus.NOT_FOUND, "Lote ou arquivo não localizado.");
  }

  public Optional<String> existente(String cnpj, String periodo, String hash) {
    return db
        .queryForList(
            "SELECT id FROM lote WHERE cnpj=? AND competencia=? AND hash_pdf=?",
            String.class,
            cnpj,
            periodo,
            hash)
        .stream()
        .findFirst();
  }

  @Transactional
  public String criar(
      String cnpj,
      String periodo,
      String hash,
      String nome,
      int paginas,
      List<Operacao> ops,
      byte[] pdf) {
    String id = UUID.randomUUID().toString();
    int n =
        db.update(
            """
            INSERT INTO lote(id,cnpj,competencia,hash_pdf,nome,paginas,operacoes,origem_pdf,criado)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(cnpj,competencia,hash_pdf) DO NOTHING
            """,
            id,
            cnpj,
            periodo,
            hash,
            nome,
            paginas,
            json.writeValueAsString(ops),
            pdf,
            Instant.now().toString());
    if (n == 0) return existente(cnpj, periodo, hash).orElseThrow();
    if (paginas == 0) evento(id, 1, "SEM_MOVIMENTO_DECLARADO", nome, Map.of());
    else evento(id, 1, "IMPORTADO", nome, Map.of("sha256", hash));
    return id;
  }

  public List<Resumo> listar() {
    return db.query(
        "SELECT id,cnpj,competencia,nome,versao,estado FROM lote ORDER BY criado DESC",
        (r, n) ->
            new Resumo(
                r.getString(1),
                r.getString(2),
                r.getString(3),
                r.getString(4),
                r.getLong(5),
                r.getString(6)));
  }

  public Lote obter(String id) {
    return db
        .query(
            "SELECT id,cnpj,competencia,nome,hash_pdf,paginas,versao,estado,protocolo,operacoes"
                + " FROM lote WHERE id=?",
            (r, n) ->
                new Lote(
                    r.getString(1),
                    r.getString(2),
                    r.getString(3),
                    r.getString(4),
                    r.getString(5),
                    r.getInt(6),
                    r.getLong(7),
                    r.getString(8),
                    r.getString(9),
                    json.readValue(r.getString(10), OPERACOES)),
            id)
        .stream()
        .findFirst()
        .orElseThrow(LoteRepository::ausente);
  }

  public byte[] arquivo(String id, boolean pdf) {
    var resultado =
        db.query(
            pdf
                ? "SELECT origem_pdf FROM lote WHERE id=? AND paginas>0"
                : "SELECT txt FROM lote WHERE id=? AND txt IS NOT NULL",
            (r, n) -> r.getBytes(1),
            id);
    if (resultado.isEmpty()) throw ausente();
    return resultado.getFirst();
  }

  public boolean possuiFretes(String cnpj, String periodo) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM lote WHERE cnpj=? AND competencia=? AND paginas>0)",
            Boolean.class,
            cnpj,
            periodo));
  }

  public void mudar(
      Lote antigo,
      String estado,
      List<Operacao> ops,
      byte[] txt,
      String protocolo,
      String acao,
      String evidencia,
      Object detalhe) {
    int count =
        db.update(
            "UPDATE lote SET estado=?,operacoes=?,txt=?,protocolo=?,versao=versao+1 WHERE id=? AND"
                + " versao=?",
            estado,
            json.writeValueAsString(ops),
            txt,
            protocolo,
            antigo.id(),
            antigo.versao());
    if (count != 1)
      throw Falha.conflito("Outra operação atualizou o lote. Recarregue antes de repetir.");
    evento(antigo.id(), antigo.versao() + 1, acao, evidencia, detalhe);
  }

  private void evento(String id, long versao, String acao, String evidencia, Object alteracoes) {
    db.update(
        "INSERT INTO historico(lote_id,versao,evento,evidencia,alteracoes,instante)"
            + " VALUES(?,?,?,?,?,?)",
        id,
        versao,
        acao,
        evidencia,
        json.writeValueAsString(alteracoes),
        Instant.now().toString());
  }

  public List<Evento> historico(String id) {
    return db.query(
        """
        SELECT h.versao, h.evento, h.evidencia, h.alteracoes, h.instante,
               EXISTS (SELECT 1 FROM anexo_recibo a WHERE a.lote_id=h.lote_id AND a.versao=h.versao) AS tem_anexo
        FROM historico h WHERE h.lote_id=? ORDER BY h.id
        """,
        (r, n) ->
            new Evento(
                r.getLong(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getBoolean("tem_anexo")),
        id);
  }

  public void arquivar(String id, long versao, String protocolo, byte[] txt) {
    db.update(
        "INSERT INTO envio(lote_id,versao,protocolo,txt,instante) VALUES(?,?,?,?,?)",
        id,
        versao,
        protocolo,
        txt,
        Instant.now().toString());
  }

  public byte[] enviado(String id, long versao) {
    return db
        .query(
            "SELECT txt FROM envio WHERE lote_id=? AND versao=?",
            (r, n) -> r.getBytes(1),
            id,
            versao)
        .stream()
        .findFirst()
        .orElseThrow(LoteRepository::ausente);
  }

  public void anexarRecibo(String id, long versao, byte[] pdf) {
    db.update("INSERT INTO anexo_recibo(lote_id,versao,pdf) VALUES(?,?,?)", id, versao, pdf);
  }

  public byte[] recibo(String id, long versao) {
    return db
        .query(
            "SELECT pdf FROM anexo_recibo WHERE lote_id=? AND versao=?",
            (r, n) -> r.getBytes(1),
            id,
            versao)
        .stream()
        .findFirst()
        .orElseThrow(LoteRepository::ausente);
  }
}
