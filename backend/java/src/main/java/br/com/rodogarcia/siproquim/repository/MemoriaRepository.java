package br.com.rodogarcia.siproquim.repository;

import static br.com.rodogarcia.siproquim.service.Formato.texto;

import br.com.rodogarcia.siproquim.model.Registros.Candidato;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class MemoriaRepository {
  private final JdbcTemplate db;

  public MemoriaRepository(JdbcTemplate db) {
    this.db = db;
  }

  @Transactional
  public int aprender(String filial, List<Candidato> candidatos, String hash, String evidencia) {
    int nova =
        db.update(
            "INSERT INTO aprendizado(filial,hash,evidencia) VALUES(?,?,?) ON CONFLICT DO NOTHING",
            filial,
            hash,
            evidencia);
    if (nova == 0) return 0;
    var unicos = new LinkedHashSet<>(candidatos);
    db.batchUpdate(
        "INSERT INTO memoria(filial,papel,nome,documento,fonte) VALUES(?,?,?,?,?) ON CONFLICT DO"
            + " NOTHING",
        unicos,
        250,
        (ps, c) -> {
          ps.setString(1, filial);
          ps.setString(2, c.papel());
          ps.setString(3, texto(c.nome()));
          ps.setString(4, c.documento());
          ps.setString(5, hash);
        });
    return unicos.size();
  }

  public record Sugestao(String escopo, String documento, String fonte, String evidencia) {}

  public List<Sugestao> consultar(String filial, String papel, String nome, boolean incluirLegado) {
    return db.query(
        """
        SELECT m.filial,m.documento,m.fonte,a.evidencia FROM memoria m JOIN aprendizado a
        ON a.filial=m.filial AND a.hash=m.fonte WHERE (m.filial=? OR (m.filial='LEGADO' AND ?=1)) AND m.papel=? AND m.nome=?
        ORDER BY m.documento,m.fonte
        """,
        (r, n) -> new Sugestao(r.getString(1), r.getString(2), r.getString(3), r.getString(4)),
        filial,
        incluirLegado ? 1 : 0,
        papel,
        texto(nome));
  }
}
