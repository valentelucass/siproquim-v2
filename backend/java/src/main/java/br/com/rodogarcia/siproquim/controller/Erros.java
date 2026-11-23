package br.com.rodogarcia.siproquim.controller;

import br.com.rodogarcia.siproquim.service.Falha;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class Erros {
  @ExceptionHandler(Falha.class)
  public ResponseEntity<?> tratar(Falha falha) {
    String origem = "";
    for (var quadro : falha.getStackTrace()) {
      var classe = quadro.getClassName();
      if (classe.startsWith("br.com.rodogarcia.siproquim.") && !classe.equals(Falha.class.getName())) {
        origem = classe.substring(classe.lastIndexOf('.') + 1) + "." + quadro.getMethodName() + ":" + quadro.getLineNumber();
        break;
      }
    }
    return ResponseEntity.status(falha.status)
        .body(Map.of("mensagem", falha.getMessage(), "pendencias", falha.pendencias, "origem", origem));
  }
}
