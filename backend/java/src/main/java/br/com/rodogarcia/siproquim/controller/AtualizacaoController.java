package br.com.rodogarcia.siproquim.controller;

import br.com.rodogarcia.siproquim.service.Atualizacoes;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/atualizacoes")
public record AtualizacaoController(Atualizacoes atualizacoes) {
  @GetMapping public Atualizacoes.Estado consultar(@RequestParam(defaultValue = "false") boolean forcar) {
    return atualizacoes.estado(forcar);
  }
  @PostMapping("/{versao}") public Atualizacoes.Instalacao instalar(@PathVariable String versao) {
    return atualizacoes.instalar(versao);
  }
}
