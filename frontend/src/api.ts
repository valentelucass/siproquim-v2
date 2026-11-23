export interface Operacao {
  id: number;
  paginas: number[];
  original: Record<string, string>;
  ajustes: Record<string, string>;
}
export interface Pendencia {
  operacao: number;
  nf: string;
  campo: string;
  motivo: string;
}
export interface Resumo {
  id: string;
  cnpj: string;
  competencia: string;
  nome: string;
  versao: number;
  estado: string;
}
export interface Lote extends Resumo {
  paginas: number;
  protocolo: string | null;
  operacoes: Operacao[];
}
export interface Resultado {
  lote: Lote;
  pendencias: Pendencia[];
  decisoes: {
    operacao: number;
    tipo: string;
    situacao: string;
    modal: string;
  }[];
}
export interface Evento {
  versao: number;
  evento: string;
  evidencia: string;
  alteracoes: string;
  temAnexo: boolean;
  instante: string;
}
export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function resposta(path: string, init: RequestInit = {}) {
  const res = await fetch("/api" + path, {
    ...init,
    cache: "no-store",
    headers: { "X-Siproquim-UI": "local", ...init.headers },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new ErroApi(
      res.status,
      e?.mensagem ||
        (res.status >= 500
          ? "O serviço local não respondeu. Confira se o backend está aberto."
          : "Não foi possível concluir a solicitação."),
    );
  }
  return res;
}
export async function ler<T>(path: string, init?: RequestInit): Promise<T> {
  return (await resposta(path, init)).json();
}
export function alterar<T>(path: string, dados: unknown, method = "POST") {
  return ler<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}
export function importar(arquivo: File, cnpj: string, competencia: string) {
  const form = new FormData();
  form.set("arquivo", arquivo);
  form.set("cnpj", cnpj);
  form.set("competencia", competencia);
  return ler<Resultado>("/lotes", { method: "POST", body: form });
}
export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const valor = (o: Operacao, c: string) =>
  o.ajustes[c] ?? o.original[c] ?? "";
export const periodo = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(v + "-15T12:00:00Z"));
export const cnpjFormatado = (v: string) =>
  v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export const estados: Record<string, string> = {
  CONFERENCIA: "Em conferência",
  EXPORTADO: "TXT exportado",
  PROCESSADO: "Processado no portal",
  PROTOCOLADO: "Protocolado",
};
const nomes: Record<string, string> = {
  nf: "Número da NF",
  cte: "Número do CT-e",
  dataNf: "Emissão da NF",
  dataCte: "Emissão do CT-e",
  dataEntrega: "Data de entrega",
  recebedor: "Responsável pelo recebimento",
  modal: "Modal de transporte",
  tipo: "Tipo de transporte",
  contratanteInternacional: "Contratante internacional",
  pais: "Código do país",
  retiradaTipo: "Local da retirada",
  entregaTipo: "Local da entrega",
  armazenamentoTipo: "Local de armazenagem",
  retiradaCidade: "Município da retirada",
  entregaCidade: "Município da entrega",
  municipalConfirmado: "Prestação municipal confirmada",
  prestacaoConfirmada: "Prestação distinta confirmada",
  duplicataDe: "Repetição da operação",
  conhecimentoDe: "CT-e vinculado à operação",
  competenciaConfirmada: "Competência confirmada",
};
const partes: Record<string, string> = {
  origem: "origem",
  destino: "destino",
  contratante: "contratante",
  retiradaTerceiro: "terceiro da retirada",
  entregaTerceiro: "terceiro da entrega",
  armazenamentoTerceiro: "terceiro da armazenagem",
};
const atributos: Record<string, string> = {
  Nome: "Nome",
  Doc: "CPF/CNPJ",
  Cidade: "Município",
  Endereco: "Endereço",
};
for (const [p, l] of Object.entries(partes))
  for (const [a, t] of Object.entries(atributos)) nomes[p + a] = t + " · " + l;
export const rotulo = (k: string) => nomes[k] || k;
export const todosCampos = Object.keys(nomes);
export const escolhas: Record<string, [string, string][]> = {
  tipo: [
    ["TN", "Nacional"],
    ["E", "Exportação"],
    ["I", "Importação"],
  ],
  contratanteInternacional: [
    ["O", "Origem"],
    ["D", "Destino"],
  ],
  ...Object.fromEntries(
    ["retiradaTipo", "entregaTipo", "armazenamentoTipo"].map((x) => [
      x,
      [
        ["P", "Próprio"],
        ["A", "Armazenagem terceirizada"],
      ],
    ]),
  ),
  ...Object.fromEntries(
    ["municipalConfirmado", "prestacaoConfirmada", "competenciaConfirmada"].map(
      (x) => [x, [["SIM", "Confirmado pelo documento"]]],
    ),
  ),
};
export const assunto = (campo: string) =>
  ({
    recebedor: "Recebedor sem identificação",
    cte: "CT-e ausente ou inválido",
    destinoDoc: "Documento do destino inválido",
    dataEntrega: "Data de entrega a conferir",
    pais: "País a conferir",
    dataCte: "Data do CT-e a conferir",
  })[campo] || rotulo(campo);
const orientacoes: Record<string, string> = {
  nf: "Copie o número da nota fiscal que acompanha a carga.",
  cte: "Copie o número do CT-e no conhecimento de transporte deste frete.",
  dataNf:
    "Use a data de emissão impressa na nota fiscal, no formato dia/mês/ano.",
  dataCte: "Use a data de emissão do CT-e deste frete, no formato dia/mês/ano.",
  dataEntrega:
    "Copie do comprovante o dia em que a carga foi recebida, no formato dia/mês/ano.",
  recebedor: "Informe quem assinou o comprovante de entrega.",
  modal:
    "Informe como a carga viajou. Use RO para rodovia, FE para ferrovia, AQ para água e AE para avião. Se usou dois meios, junte as siglas, como ROAE.",
  tipo: "Escolha nacional para um frete dentro do Brasil, exportação para uma saída ao exterior ou importação para uma entrada do exterior.",
  contratanteInternacional:
    "Confira no contrato quem contratou o frete e escolha a origem ou o destino.",
  pais: "Copie o código de três dígitos do país que aparece na tabela de países da PF.",
  retiradaTipo:
    "Confira se a retirada foi em local próprio ou em um armazém de terceiros.",
  entregaTipo:
    "Confira se a entrega foi em local próprio ou em um armazém de terceiros.",
  armazenamentoTipo:
    "Confira no documento quem responde pelo local onde a carga ficou armazenada.",
  retiradaCidade:
    "Informe a cidade e o estado onde a carga foi retirada. Exemplo: Campinas - SP.",
  entregaCidade:
    "Informe a cidade e o estado onde a carga foi entregue. Exemplo: Santos - SP.",
  municipalConfirmado:
    "Compare os endereços de retirada e entrega. Confirme se os dois ficam no mesmo município.",
  prestacaoConfirmada:
    "Confira os comprovantes antes de confirmar que a mesma nota teve dois fretes diferentes.",
  duplicataDe:
    "Se este registro repete o mesmo frete, informe o número da operação original mostrado na conferência.",
  conhecimentoDe:
    "Se outro CT-e pertence ao mesmo frete, informe o número da operação que já representa esse frete.",
  competenciaConfirmada:
    "Confira em que mês o frete foi realizado. Se a nota saiu em outro mês, registre o documento que confirma o mês escolhido.",
};
export function instrucao(campo: string): string {
  if (orientacoes[campo]) return orientacoes[campo];
  for (const [prefixo, papel] of Object.entries(partes)) {
    const atributo = campo.slice(prefixo.length);
    if (!campo.startsWith(prefixo)) continue;
    switch (atributo) {
      case "Nome":
        return (
          "Copie o nome ou a razão social que consta no documento (" +
          papel +
          ")."
        );
      case "Doc":
        return (
          "Confira o CPF ou CNPJ no documento (" +
          papel +
          "). Preserve os zeros do início."
        );
      case "Cidade":
        return (
          "Informe a cidade e o estado que constam no documento (" +
          papel +
          "). Exemplo: Campinas - SP."
        );
      case "Endereco":
        return (
          "Copie o endereço que consta no documento (" +
          papel +
          "), incluindo o número quando informado."
        );
    }
  }
  return "Confira este dado no documento do frete.";
}
export function problema(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Ocorreu um erro ao consultar o lote.";
}
