package br.com.rodogarcia.siproquim.model;

import java.util.*;

public record Operacao(
    int id, List<Integer> paginas, Map<String, String> original, Map<String, String> ajustes) {
  public Operacao {
    paginas = List.copyOf(paginas);
    original = Map.copyOf(original);
    ajustes = Map.copyOf(ajustes);
  }

  public String valor(String campo) {
    return ajustes.getOrDefault(campo, original.getOrDefault(campo, "")).strip();
  }

  public String padrao(String campo, String padrao) {
    return ajustes.containsKey(campo) || original.containsKey(campo) ? valor(campo) : padrao;
  }

  public Operacao corrigir(Map<String, String> campos) {
    var resultado = new HashMap<>(ajustes);
    resultado.putAll(campos);
    return new Operacao(id, paginas, original, resultado);
  }
}
