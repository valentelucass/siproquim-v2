package br.com.rodogarcia.siproquim.service;

import br.com.rodogarcia.siproquim.model.Registros.Pendencia;
import java.util.List;
import org.springframework.http.HttpStatus;

public final class Falha extends RuntimeException {
  public final HttpStatus status;
  public final List<Pendencia> pendencias;

  public Falha(HttpStatus status, String message) {
    this(status, message, List.of());
  }

  public Falha(HttpStatus status, String message, List<Pendencia> pendencias) {
    super(message);
    this.status = status;
    this.pendencias = List.copyOf(pendencias);
  }

  public static Falha dados(String mensagem) {
    return new Falha(HttpStatus.UNPROCESSABLE_ENTITY, mensagem);
  }

  public static Falha conflito(String mensagem) {
    return new Falha(HttpStatus.CONFLICT, mensagem);
  }
}
