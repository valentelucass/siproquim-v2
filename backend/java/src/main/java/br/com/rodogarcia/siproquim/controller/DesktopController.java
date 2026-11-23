package br.com.rodogarcia.siproquim.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.web.bind.annotation.*;

@RestController
@ConditionalOnProperty(name = "siproquim.desktop", havingValue = "true")
@RequestMapping("/api/desktop")
public class DesktopController {
  private final ConfigurableApplicationContext contexto;
  private final String versao;
  public DesktopController(ConfigurableApplicationContext contexto, @Value("${siproquim.versao}") String versao) {
    this.contexto = contexto;
    this.versao = versao;
  }
  @GetMapping("/versao") public String versao() { return versao; }

  @PostMapping("/encerrar") public void encerrar() {
    Thread.ofPlatform().start(() -> {
      try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
      contexto.close();
    });
  }
}
