package br.com.rodogarcia.siproquim.service;

import br.com.rodogarcia.siproquim.model.Registros.Candidato;
import br.com.rodogarcia.siproquim.repository.MemoriaRepository;
import java.io.IOException;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class LegadoService {
  private final MemoriaRepository memoria;

  public LegadoService(MemoriaRepository memoria) {
    this.memoria = memoria;
  }

  public record Migracao(int ativosValidos, int ignorados, int novosVinculos) {}

  public Migracao importar(byte[] backup, String referencia) throws IOException {
    if (referencia == null || referencia.isBlank() || referencia.length() > 1000)
      throw Falha.dados("Informe a origem desta cópia da memória da V1.");
    if (backup.length < 100
        || !new String(backup, 0, 16, java.nio.charset.StandardCharsets.US_ASCII)
            .equals("SQLite format 3\0"))
      throw Falha.dados("Selecione uma cópia SQLite da memória da V1.");
    Path temp = Files.createTempFile("siproquim-memoria-v1-", ".sqlite");
    try {
      Files.write(temp, backup);
      var candidatos = new LinkedHashSet<Candidato>();
      int ignorados = 0;
      try (Connection conn =
              DriverManager.getConnection("jdbc:sqlite:" + temp.toUri() + "?mode=ro&immutable=1");
          Statement st = conn.createStatement()) {
        st.execute("PRAGMA trusted_schema=OFF");
        st.execute("PRAGMA query_only=ON");
        try (ResultSet t =
            st.executeQuery("SELECT type FROM sqlite_master WHERE name='learned_pairs'")) {
          if (!t.next() || !"table".equals(t.getString(1)))
            throw Falha.dados("Tabela de aprendizado V1 ausente.");
        }
        try (ResultSet rows =
            st.executeQuery("SELECT nome_original,documento,campo,status FROM learned_pairs")) {
          while (rows.next()) {
            String nome = Objects.toString(rows.getString(1), "").strip();
            String doc = Formato.digitos(Objects.toString(rows.getString(2), ""));
            String papel =
                switch (Objects.toString(rows.getString(3), "")) {
                  case "emitente" -> "origem";
                  case "destinatario" -> "destino";
                  case "contratante" -> "contratante";
                  default -> "";
                };
            if (!"ativo".equals(rows.getString(4))
                || papel.isEmpty()
                || !Formato.imprimivel(nome)
                || !Formato.documento(doc, !papel.equals("origem"))) {
              ignorados++;
              continue;
            }
            candidatos.add(new Candidato(papel, nome, doc));
          }
        }
      } catch (SQLException e) {
        throw Falha.dados("A cópia SQLite é inválida ou incompatível com a V1.");
      }
      int novos =
          memoria.aprender("LEGADO", List.copyOf(candidatos), LoteService.hash(backup), referencia);
      return new Migracao(candidatos.size(), ignorados, novos);
    } finally {
      Files.deleteIfExists(temp);
    }
  }
}
