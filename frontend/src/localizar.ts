import type { Operacao } from "./api";

type Texto = { str: string };
type Bloco = [number, number];

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const secoes: Record<string, string[]> = {
  origem: ["EMITENTE"],
  destino: ["DESTINATARIO"],
  contratante: ["CONTRATANTE", "CONTRANTE"],
};
const cabecalhos = Object.values(secoes).flat();
const rotulos: Record<string, RegExp> = {
  nf: /^NF$/,
  dataNf: /^DATA NF$/,
  cte: /^(?:N[°ºO.]?\s*)?CT-?E$/,
  dataCte: /^DATA$/,
  recebedor: /^RECEBEDOR$/,
  dataEntrega: /^DATA ENTREGA$/,
  Doc: /^(?:CNPJ|CPF)(?:\/(?:CPF|CNPJ))?$/,
  Cidade: /^CIDADE$/,
  Endereco: /^(?:END|ENDERECO)\.?$/,
};
function corresponde(impresso: string, valor: string, campo: string) {
  if (campo.endsWith("Doc")) {
    const limpo = (v: string) => v.replace(/[^A-Z0-9]/g, "");
    return !!limpo(valor) && limpo(impresso) === limpo(valor);
  }
  if (campo === "dataEntrega" && /^\d{2}\/\d{2}\/\d{4}$/.test(valor))
    return impresso === valor || impresso.startsWith(valor + " ");
  return impresso === valor;
}

export function localizar<T extends Texto>(
  items: T[],
  op: Operacao,
  campo: string,
): T | null {
  const texto = items.map((i) => normal(i.str));
  const labels = texto.map((s) => s.split(":", 1)[0].trim());
  // Relatórios históricos separam rótulo e valor em fragmentos diferentes do PDF.
  function procurar(bloco: Bloco, campo: string, chave: string): number | null {
    const resultado: number[] = [];
    const esperado = normal(op.original[campo] || "");
    for (let i = bloco[0]; i < bloco[1]; i++) {
      if (!rotulos[chave]?.test(labels[i])) continue;
      const separador = texto[i].indexOf(":");
      const inline =
        separador === -1 ? "" : texto[i].slice(separador + 1).trim();
      if (!esperado) {
        resultado.push(i);
        continue;
      }
      if (inline) {
        if (corresponde(inline, esperado, campo)) resultado.push(i);
      } else if (
        i + 1 < bloco[1] &&
        corresponde(texto[i + 1].replace(/^:\s*/, ""), esperado, campo)
      )
        resultado.push(i + 1);
    }
    return resultado.length === 1 ? resultado[0] : null;
  }
  const starts = labels.flatMap((s, i) => (s === "DATA NF" ? [i] : []));
  let blocos = starts
    .map((n, i): Bloco => [n, starts[i + 1] ?? items.length])
    .filter(
      (bloco) => !!op.original.nf && procurar(bloco, "nf", "nf") !== null,
    );
  if (blocos.length > 1 && op.original.cte)
    blocos = blocos.filter((bloco) => procurar(bloco, "cte", "cte") !== null);
  if (blocos.length !== 1) return null;
  let [a, b] = blocos[0];
  const parte = /^(origem|destino|contratante)(Doc|Nome|Cidade|Endereco)$/.exec(
    campo,
  );
  const chave = parte?.[2] || campo;
  if (parte) {
    const inicio = labels.flatMap((s, i) =>
      i >= a && i < b && secoes[parte[1]].includes(s) ? [i] : [],
    );
    if (inicio.length !== 1) return null;
    a = inicio[0] + 1;
    const fim = labels.findIndex(
      (s, i) =>
        i >= a && i < b && (cabecalhos.includes(s) || rotulos.cte.test(s)),
    );
    if (fim !== -1) b = fim;
    if (chave === "Nome") {
      const valor = normal(op.original[campo] || "");
      const candidatos = texto.flatMap((s, i) =>
        i >= a && i < b && valor && s === valor ? [i] : [],
      );
      return candidatos.length === 1 ? items[candidatos[0]] : null;
    }
  }
  if (!rotulos[chave]) return null;
  const indice = procurar([a, b], campo, chave);
  return indice === null ? null : items[indice];
}
