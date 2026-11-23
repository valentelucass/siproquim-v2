package br.com.rodogarcia.siproquim.controller;

import br.com.rodogarcia.siproquim.service.Falha;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class Erros {
  @ExceptionHandler(Falha.class)
  public ResponseEntity<?> tratar(Falha falha) {
    return ResponseEntity.status(falha.status)
        .body(Map.of("mensagem", falha.getMessage(), "pendencias", falha.pendencias));
  }
}
