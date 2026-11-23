import {version} from "../package.json";

const inicio = new Date();
const eventos: string[] = [];
let ultimaFalha = "";
let ultimaApi = "Sem chamadas concluídas";
let versaoApi = "Não informada";

function registrar(texto: string, falha = false) {
  const linha = new Date().toISOString() + "  " + texto;
  if (falha) ultimaFalha = linha;
  eventos.push(linha);
  if (eventos.length > 18) eventos.shift();
}

export const acao = (nome: string) => registrar(nome);

export function registrarVersaoApi(versao: unknown) {
  if (typeof versao === "string" && /^\d+\.\d+\.\d+$/.test(versao)) versaoApi = versao;
}

function rotaTecnica(path: string) {
  const rota = path.split("?")[0];
  if (["/lotes", "/lotes/sem-movimento", "/filiais", "/memoria", "/memoria/importar", "/memoria/importar-v1", "/atualizacoes"].includes(rota)) return rota;
  if (/^\/atualizacoes\/\d+\.\d+\.\d+$/.test(rota)) return "/atualizacoes/:versao";
  const lote = rota.match(/^\/lotes\/[^/]+(?:\/(operacoes|previa-txt|exportar|processamento|recibo|reabrir|historico|pdf|txt|salvar-txt)(?:\/(\d+))?)?$/);
  if (!lote) return "/outro";
  return "/lotes/:id" + (lote[1] ? "/" + lote[1] : "") + (lote[2] ? "/:versao" : "");
}

export function registrarApi(path: string, metodo: string, res: Response | null, inicioMs: number, detalhe?: {origem?: unknown; mensagem?: unknown}) {
  const status = res ? "HTTP " + res.status : "Sem resposta da API";
  registrarVersaoApi(res?.headers.get("X-Siproquim-Versao"));
  const falha = !res?.ok;
  const origem = detalhe?.origem;
  // Só as falhas de negócio identificadas pelo serviço têm mensagem própria para suporte.
  let dados = "";
  if (falha && typeof origem === "string" && /^[A-Za-z]+\.[A-Za-z0-9_$]+:\d{1,5}$/.test(origem)) {
    dados = " · " + origem;
    if (typeof detalhe?.mensagem === "string") dados += " · " + detalhe.mensagem.replace(/[\r\n]+/g," ").slice(0,220);
  }
  const evento = metodo + " /api" + rotaTecnica(path) + " · " + status + " · " + Math.round(performance.now()-inicioMs) + " ms" + dados;
  ultimaApi = status + " às " + new Date().toISOString();
  registrar(evento, falha);
}

const falhasDeFormulario = new Set(["Selecione a filial declarante.", "Selecione um relatório PDF válido.", "Arquivo selecionado com formato incompatível."]);
export function registrarErroLocal(erro: unknown, area: string, origem?: string, linha?: number, coluna?: number) {
  if (erro instanceof Error && erro.name === "AbortError") return;
  const tipo = erro instanceof Error && /^[a-zA-Z]{1,48}$/.test(erro.name) ? erro.name : "Erro";
  let detalhe = erro instanceof Error && falhasDeFormulario.has(erro.message) ? " · " + erro.message : "";
  const arquivo = origem?.split("?")[0].match(/\/(?:assets|src)\/([\w.-]+\.(?:m?js|tsx?))$/)?.[1];
  if (arquivo && linha) detalhe += " · " + arquivo + ":" + linha + ":" + (coluna || 0);
  registrar(area + " · " + tipo + detalhe,true);
}

export function relatorioDeSuporte(contexto: string[]) {
  const ua = navigator.userAgent;
  const naveg = ua.match(/(?:Edg|Firefox|Chrome)\/[\d.]+/g)?.at(-1) || ua.match(/Version\/[\d.]+(?=.*Safari)/)?.[0] || "Não identificado";
  const sistema = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS/iOS" : /Linux/.test(ua) ? "Linux" : "Não identificado";
  return [
    "SIPROQUIM · Relatório para o desenvolvedor",
    "Gerado em " + new Date().toISOString() + " · " + Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Interface " + version + " · Backend " + versaoApi + " · " + (import.meta.env.DEV ? "Desenvolvimento" : "Distribuição"),
    "Sistema " + sistema + " · Navegador " + naveg + " · Janela " + innerWidth + " × " + innerHeight,
    ...contexto, "Última resposta do serviço: " + ultimaApi, "",
    "Última falha técnica", ultimaFalha || "Nenhuma falha técnica registrada nesta sessão.", "",
    "Atividade recente · desde " + inicio.toISOString(), ...eventos.slice(-18),
  ].join("\n");
}
