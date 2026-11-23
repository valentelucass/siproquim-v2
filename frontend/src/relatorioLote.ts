import { rotulo, valor, type Operacao, type Pendencia, type Resultado } from "./api";

const nomesDasVerificacoes: Record<string, string> = {
  competenciaConfirmada: "Competência da nota",
  prestacaoConfirmada: "Ocorrências da mesma nota",
};

function dadoEmRevisao(op: Operacao, campo: string): string {
  if (campo === "competenciaConfirmada") {
    const emissao = valor(op, "dataNf");
    return /^\d{2}\/\d{2}\/\d{4}$/.test(emissao) ? "emissão da NF em " + emissao : "data de emissão a conferir";
  }
  const conteudo = valor(op, campo).trim();
  if (!conteudo) return "em branco";
  if (campo.endsWith("Doc")) {
    const digitos = conteudo.replace(/\D/g, "").length;
    return digitos + " dígitos" + (/\p{L}/u.test(conteudo) ? ", contém letras" : "");
  }
  if (campo === "recebedor") {
    const marcador = conteudo.toLocaleUpperCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "")
      .match(/\b(CARIMBO|CARIMBADO|ASSINATURA|ASSINADO|RUBRICA|ILEGIVEL|INDEFINIDO|SEM NOME|NAO INFORMADO|NAO CONSTA)\b/);
    if (marcador) return "marcador " + marcador[1];
  }
  if (/^data/.test(campo) && /^\d{2}\/\d{2}\/\d{4}$/.test(conteudo)) return conteudo;
  if (campo === "cte" && /^\d{1,9}$/.test(conteudo)) return conteudo;
  return "preenchido, requer conferência";
}

export function descreverLote({ lote, decisoes, pendencias }: Resultado): string[] {
  const porOperacao = new Map<number, Pendencia[]>();
  const porCampo = new Map<string, number>();
  for (const p of pendencias) {
    const grupo = porOperacao.get(p.operacao);
    if (grupo) grupo.push(p);
    else porOperacao.set(p.operacao, [p]);
    porCampo.set(p.campo, (porCampo.get(p.campo) ?? 0) + 1);
  }
  const total = lote.operacoes.length;
  const linhas = ["", "Conferência do lote"];
  if (!total) return [...linhas, "Lote sem movimento · nenhuma operação de frete."];
  linhas.push(total + " operações · " + porOperacao.size + " em revisão · " +
    (total - porOperacao.size) + " sem pendências nas regras locais.");
  if (porCampo.size) {
    linhas.push("Pendências por campo (" + pendencias.length + "): " +
      Array.from(porCampo, ([campo, n]) => rotulo(campo) + " (" + n + ")").join(", "));
  }
  const decisoesPorId = new Map(decisoes.map(d => [d.operacao, d]));
  for (const op of lote.operacoes) {
    const falhas = porOperacao.get(op.id) ?? [];
    const decisao = decisoesPorId.get(op.id);
    const pendentes = new Set(falhas.map(p => p.campo));
    const nf = valor(op, "nf");
    const nota = /^[A-Za-z0-9]{1,10}$/.test(nf) ? nf : nf ? "fora do formato" : "em branco";
    const cte = valor(op, "cte");
    const situacao = falhas.length ? "Em revisão (" + falhas.length + ")"
      : decisao?.situacao === "REPETICAO_CONFIRMADA" ? "Repetição confirmada"
      : decisao?.situacao === "CTE_VINCULADO" ? "CT-e vinculado" : "Sem pendências nas regras locais";
    linhas.push("", "Op. " + op.id + " · NF " + nota + " · pág. " + op.paginas.join(", ") +
      (/^\d{1,9}$/.test(cte) ? " · CT-e " + cte : "") + " · " + situacao);
    for (const p of falhas) {
      linhas.push("  A revisar: " + rotulo(p.campo) + " [" + p.campo + "] · " +
        dadoEmRevisao(op, p.campo) + ". " + p.motivo);
    }
    if (decisao?.camposAvaliados) {
      const atendidos = decisao.camposAvaliados.filter(c => !pendentes.has(c))
        .map(c => nomesDasVerificacoes[c] ?? rotulo(c));
      linhas.push("  Verificações atendidas: " + (atendidos.join(", ") || "nenhuma") + ".");
    }
    const ajustes = Object.keys(op.ajustes).map(rotulo);
    if (ajustes.length) linhas.push("  Campos com correção registrada: " + ajustes.join(", ") + ".");
  }
  return linhas;
}
