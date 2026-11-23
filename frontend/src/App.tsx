import { Activity, useEffect, useMemo, useRef, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Mail, SquareArrowOutUpRight } from "lucide-react";
import { Atualizacao } from "./Atualizacao";
import { Badge } from "@astryxdesign/core/Badge";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Card } from "@astryxdesign/core/Card";
import { Arquivo, Historico } from "./Arquivo";
import { PendenciasTxt } from "./PendenciasTxt";
import { Guia } from "./Guia";
import { Barra, type View } from "./Barra";
import {
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Download,
  FileSearch,
  FileText,
  Pencil,
  Search,
  Table2,
} from "lucide-react";
import {
  alterar,
  baixar,
  cnpjFormatado,
  estados,
  ler,
  periodo,
  problema,
  resposta,
  rotulo,
  assunto,
  instrucao,
  todosCampos,
  valor,
  type Resumo,
  type Resultado,
} from "./api";
import {
  Btn,
  Editor,
  ImportForm,
  Modal,
  Movimento,
  type Rascunho,
} from "./Forms";
import { PassoAPasso } from "./PassoAPasso";
import { tipoCena, etapas } from "./roteiro";
import { exemplo } from "./exemploRoteiro";
import { Dados, Documento } from "./Documento";
const stored = (key: string) => {
  try {
    return localStorage.getItem("sipro." + key);
  } catch {
    return null;
  }
};
function remember(k: string, v: string) {
  try {
    localStorage.setItem("sipro." + k, v);
  } catch {
    /* modo privado */
  }
}
function Authority({ state }: { state: string }) {
  return (
    <Badge
      variant={state === "CONFERENCIA" ? "neutral" : "success"}
      label={estados[state] || state}
    />
  );
}
const dicas = {
  corrigir:
    "Altere o valor deste campo depois de conferir o comprovante e informe de onde veio a correção.",
  campos:
    "Consulte os outros dados desta operação e escolha qual deles quer conferir.",
};
const TAMANHO_PAGINA = 25;
const textoBusca = (texto: string) =>
  texto
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

export default function App() {
  const [passo, ir] = useState<number | null>(null);
  const [loteVisita, setLoteVisita] = useState<Resultado | null>(null);
  const cena = passo === null ? undefined : etapas[passo].cena;
  const emVisita = passo !== null;
  const formularioNaTela = cena === "importar" || cena === "txt";
  const [tema, setTema] = useState<"light" | "dark">(() =>
    (stored("tema") ||
      (window.matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light")) === "dark"
      ? "dark"
      : "light",
  );
  const [viewAtual, go] = useState<View>("conferencia");
  const view = cena ? tipoCena[cena].view : viewAtual;
  const [loteAtual, setR] = useState<Resultado | null>(null),
    [lista, setLista] = useState<Resumo[]>([]),
    [wait, setWait] = useState(false),
    [loading, setLoading] = useState(true),
    [erro, setErro] = useState(""),
    [toast, setToast] = useState(""),
    [ep, refresh] = useState(0);
  const [opAtual, seleOp] = useState(0),
    [campoAtual, seleCampo] = useState(""),
    [paginaAtualPdf, setPagina] = useState(1),
    [tabAtual, setTab] = useState<"pdf" | "dados">("pdf"),
    [filtroAtual, filtrar] = useState<"pend" | "todas">("pend"),
    [buscaAtual, buscar] = useState("");
  const [paginaFilaAtual, setPaginaFila] = useState(0);
  const [fechadoAtual, setFechado] = useState(false);
  const [modalAtual, setModal] = useState(""),
    [parte, setParte] = useState(""),
    [txt, setTxt] = useState(""),
    [txtError, setTxtError] = useState("");
  const modal = cena ? tipoCena[cena].modal : modalAtual;
  const rascunho = useRef<Rascunho | null>(null);
  useEffect(() => {
    if (modalAtual !== "editar") rascunho.current = null;
  }, [modalAtual]);
  const generation = useRef(0);
  const r = emVisita ? loteVisita : loteAtual;
  const primeira = emVisita ? r?.pendencias[0] : undefined;
  const opId = primeira?.operacao ?? opAtual;
  const campo = primeira?.campo ?? campoAtual;
  const filtro = emVisita ? "pend" : filtroAtual;
  const busca = emVisita ? "" : buscaAtual;
  const tab = emVisita ? "pdf" : tabAtual;
  const fechado = emVisita ? false : fechadoAtual;
  const paginaFila = emVisita ? 0 : paginaFilaAtual;
  const inicioRoteiro = useRef<HTMLElement | null>(null);
  function iniciarRoteiro() {
    inicioRoteiro.current = document.activeElement as HTMLElement;
    setLoteVisita(
      loteAtual?.pendencias.length &&
        ["CONFERENCIA", "EXPORTADO"].includes(loteAtual.lote.estado)
        ? loteAtual
        : exemplo,
    );
    ir(0);
  }
  function sairDoRoteiro() {
    ir(null);
    setLoteVisita(null);
    requestAnimationFrame(() => {
      const inicio = inicioRoteiro.current;
      (inicio?.isConnected
        ? inicio
        : document.querySelector<HTMLElement>("header nav button")
      )?.focus({ preventScroll: true });
    });
  }
  const operacoesPorId = useMemo(
    () => new Map(r?.lote.operacoes.map((o) => [o.id, o])),
    [r],
  );
  const primeiroCampo = useMemo(() => {
    const campos = new Map<number, string>();
    for (const p of r?.pendencias ?? [])
      if (!campos.has(p.operacao)) campos.set(p.operacao, p.campo);
    return campos;
  }, [r]);
  const op = operacoesPorId.get(opId);
  const pagina = emVisita ? op?.paginas[0] || 1 : paginaAtualPdf;
  const q = r?.pendencias || [];
  const podeEditar = r && ["CONFERENCIA", "EXPORTADO"].includes(r.lote.estado);
  const nops = r?.lote.operacoes.length || 0;
  const pendOps = primeiroCampo.size;
  const ready = Math.max(0, nops - pendOps);
  function select(n: number, c: string, result = r) {
    setFechado(false);
    seleOp(n);
    seleCampo(c);
    setPagina(result?.lote.operacoes.find((o) => o.id === n)?.paginas[0] || 1);
  }
  function apply(res: Resultado, reset = true) {
    setR(res);
    if (reset) {
      setPaginaFila(0);
      const p = res.pendencias[0],
        o = res.lote.operacoes[0];
      select(p?.operacao || o?.id || 0, p?.campo || "nf", res);
      filtrar(p ? "pend" : "todas");
      buscar("");
      setTab("pdf");
    }
  }
  function move(v: View) {
    go(v);
    setErro("");
  }
  useEffect(() => {
    let active = true;
    generation.current++;
    setLoading(true);
    setErro("");
    (async () => {
      const list = await ler<Resumo[]>("/lotes");
      if (!active) return;
      setLista(list);
      if (list.length) {
        const res = await ler<Resultado>("/lotes/" + list[0].id);
        if (active) {
          apply(res);
        }
      } else if (active) {
        setR(null);
        go("lotes");
      }
    })()
      .catch((e) => active && setErro(problema(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ep]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4300);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (modal !== "txt" || !r) return;
    let active = true;
    setTxt("");
    setTxtError("");
    if (!q.length)
      resposta("/lotes/" + r.lote.id + "/previa-txt")
        .then((x) => x.text())
        .then((v) => active && setTxt(v))
        .catch((e) => active && setTxtError(problema(e)));
    return () => {
      active = false;
    };
  }, [modal, r?.lote.id, r?.lote.versao]);
  async function abrirLote(id: string, destino: View = "conferencia") {
    const g = ++generation.current;
    setWait(true);
    try {
      const res = await ler<Resultado>("/lotes/" + id);
      if (g === generation.current) {
        apply(res);
        move(destino);
      }
    } catch (e) {
      if (g === generation.current) setErro(problema(e));
    } finally {
      setWait(false);
    }
  }
  function record(res: Resultado) {
    apply(res, false);
    setLista((prev) => [res.lote, ...prev.filter((l) => l.id !== res.lote.id)]);
    setModal("");
  }
  async function download(versao?: number, pdf = false) {
    if (!r) return false;
    setWait(true);
    setErro("");
    try {
      const base = "/lotes/" + r.lote.id;
      if (pdf) {
        const result = await resposta(base + "/recibo/" + versao);
        baixar(await result.blob(), "recibo-v" + versao + ".pdf");
      } else {
        const uri =
          base + "/salvar-txt" + (versao ? "?versaoEnviada=" + versao : "");
        const salvo = await alterar<{ nome: string }>(uri, {});
        setToast("Salvo em Downloads: " + salvo.nome);
      }
      return true;
    } catch (e) {
      setErro(problema(e));
      return false;
    } finally {
      setWait(false);
    }
  }
  async function exportar() {
    if (!r) return;
    setWait(true);
    setTxtError("");
    try {
      if (r.lote.estado === "CONFERENCIA") {
        const res = await alterar<Resultado>(
          "/lotes/" + r.lote.id + "/exportar",
          { versao: r.lote.versao },
        );
        record(res);
      }
      await download();
    } catch (e) {
      setTxtError(problema(e));
    } finally {
      setWait(false);
    }
  }
  function corrected(res: Resultado) {
    record(res);
    const p = res.pendencias.find(
      (x) => x.operacao === opId && x.campo === campo,
    );
    if (p) {
      setToast("Correção registrada. O campo ainda precisa de conferência.");
      return;
    }
    const next =
      res.pendencias.find((x) => x.operacao === opId) || res.pendencias[0];
    if (next) mostrarPendencia(next, res);
    else {
      filtrar("todas");
      buscar("");
      setPaginaFila(
        Math.max(
          0,
          Math.floor(
            res.lote.operacoes.findIndex((o) => o.id === opId) / TAMANHO_PAGINA,
          ),
        ),
      );
      select(opId, campo, res);
    }
    setToast(
      next
        ? "Correção salva. A próxima pendência está selecionada."
        : "Correção salva. O lote está pronto para prévia do TXT.",
    );
  }
  const linhas = useMemo(() => {
    if (!r) return [];
    const itens =
      filtro === "pend"
        ? r.pendencias.map((p) => ({
            id: p.operacao,
            c: p.campo,
            title: assunto(p.campo),
            motivo: p.motivo,
            nf: p.nf,
          }))
        : r.lote.operacoes.map((o) => ({
            id: o.id,
            c: primeiroCampo.get(o.id) || "nf",
            title: "Nota fiscal " + valor(o, "nf"),
            motivo: valor(o, "destinoNome"),
            nf: valor(o, "nf"),
          }));
    const termo = textoBusca(busca);
    if (!termo) return itens;
    return itens.filter((x) => {
      const papel = x.c.startsWith("destino")
        ? "destinatário"
        : x.c.startsWith("origem")
          ? "emitente"
          : "";
      return textoBusca(
        ["NF", x.nf, x.title, x.motivo, rotulo(x.c), papel].join(" "),
      ).includes(termo);
    });
  }, [r, filtro, busca, primeiroCampo]);
  const totalPaginas = Math.ceil(linhas.length / TAMANHO_PAGINA);
  const paginaAtual = Math.min(paginaFila, Math.max(0, totalPaginas - 1));
  const visiveis = linhas.slice(
    paginaAtual * TAMANHO_PAGINA,
    (paginaAtual + 1) * TAMANHO_PAGINA,
  );
  function mostrarPendencia(
    p: NonNullable<typeof r>["pendencias"][number],
    res: Resultado,
  ) {
    buscar("");
    filtrar("pend");
    setPaginaFila(Math.floor(res.pendencias.indexOf(p) / TAMANHO_PAGINA));
    select(p.operacao, p.campo, res);
  }
  const inlineEditor =
    r &&
    op &&
    modal === "editar" &&
    view === "conferencia" &&
    visiveis.some(
      (x) => x.id === opId && (filtro === "todas" || x.c === campo),
    );
  function conflito() {
    setModal("");
    if (r) void abrirLote(r.lote.id);
    setToast("O lote mudou. Confira a versão atual antes de corrigir.");
  }
  const selected = q.find((p) => p.operacao === opId && p.campo === campo);
  const irParaPdf = op && (
    <a
      className="paneljump"
      href="#previa-relatorio"
      onClick={() => {
        setTab("pdf");
        if (!op.paginas.includes(pagina)) setPagina(op.paginas[0] || 1);
      }}
    >
      <FileSearch size={15} aria-hidden="true" /> Ver página no PDF
    </a>
  );
  return (
    <Theme theme={neutralTheme} mode={tema}>
      <div className="app" data-mode={tema} data-cena={cena}>
        <a className="skip" href="#principal">
          Ir para o conteúdo
        </a>
        <div className="maincol">
          <Barra
            view={view}
            emRoteiro={emVisita}
            go={move}
            roteiro={iniciarRoteiro}
            criar={() => setModal("import")}
            previa={() => setModal("txt")}
            lote={!!r}
            tema={tema}
            toggle={() => {
              const v = tema === "light" ? "dark" : "light";
              setTema(v);
              remember("tema", v);
            }}
          />
          {passo !== null && (
            <PassoAPasso
              indice={passo}
              ir={ir}
              fechar={sairDoRoteiro}
              exemplo={loteVisita === exemplo}
            />
          )}
          <main id="principal" inert={emVisita}>
            {erro && !emVisita && (
              <Banner
                status="error"
                role="alert"
                title={erro}
                endContent={
                  <Btn
                    label="Tentar de novo"
                    variant="secondary"
                    onClick={() => refresh((v) => v + 1)}
                  />
                }
              />
            )}
            {loading && !emVisita && (
              <div className="loadinggrid" role="status">
                <VisuallyHidden>Abrindo o ambiente…</VisuallyHidden>
                <Skeleton width="100%" height={42} />
                <Skeleton width="100%" height="55vh" />
              </div>
            )}
            {view === "conferencia" &&
              !formularioNaTela &&
              (!loading || emVisita) &&
              r && (
                <>
                  <section className="summarystrip" aria-label="Resumo do lote">
                    <div className="sumname">
                      <FileText size={17} />
                      <strong>
                        {r.lote.paginas ? r.lote.nome : "Lote sem movimento"}
                      </strong>
                      <Authority state={r.lote.estado} />
                    </div>
                    <div className="sumdata">
                      <span>{periodo(r.lote.competencia)}</span>
                      <i /> <span>{cnpjFormatado(r.lote.cnpj)}</span>
                      <i />
                      <span>
                        {ready} de {nops} operações prontas
                      </span>
                    </div>
                  </section>
                  <div className="desk">
                    <Card padding={0} className="panel inspect">
                      <div className="panelhead">
                        <div>
                          <h2 id="fila-revisao" tabIndex={-1}>
                            Fila de revisão
                          </h2>
                          <p>
                            Selecione uma ocorrência para conferir o campo e a
                            página.
                          </p>
                        </div>
                        <Badge
                          variant={q.length ? "warning" : "success"}
                          label={
                            q.length +
                            " " +
                            (q.length === 1 ? "pendência" : "pendências")
                          }
                        />
                      </div>
                      <TabList
                        aria-label="Mostrar operações"
                        role="tablist"
                        size="sm"
                        layout="fill"
                        hasDivider
                        value={filtro}
                        onChange={(v) => {
                          filtrar(v as "pend" | "todas");
                          setPaginaFila(0);
                        }}
                      >
                        <Tab
                          value="pend"
                          label={"Pendências (" + q.length + ")"}
                          panelId="lista-ocorrencias"
                        />
                        <Tab
                          value="todas"
                          label={"Todas as operações (" + nops + ")"}
                          panelId="lista-ocorrencias"
                        />
                      </TabList>
                      <div className="findfield">
                        <TextInput
                          label={
                            filtro === "pend"
                              ? "Buscar nota ou campo"
                              : "Buscar nota ou destinatário"
                          }
                          isLabelHidden
                          value={busca}
                          onChange={(v) => {
                            buscar(v);
                            setPaginaFila(0);
                          }}
                          placeholder={
                            filtro === "pend"
                              ? "Buscar nota ou campo…"
                              : "Buscar nota ou destinatário…"
                          }
                          startIcon={<Search size={16} />}
                          hasClear
                          size="sm"
                        />
                      </div>
                      <div
                        className="issues"
                        id="lista-ocorrencias"
                        role="tabpanel"
                        aria-label="Ocorrências"
                      >
                        {visiveis.map((x) => {
                          const active =
                              x.id === opId &&
                              (filtro === "todas" || campo === x.c),
                            o = operacoesPorId.get(x.id)!;
                          const pend = primeiroCampo.has(x.id);
                          return (
                            <Card
                              key={x.id + x.c}
                              padding={2}
                              className={
                                "issuecard " + (active ? "current" : "")
                              }
                            >
                              <Collapsible
                                isOpen={active && !fechado}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setModal("");
                                    select(x.id, x.c);
                                    setTab("pdf");
                                  } else setFechado(true);
                                }}
                                trigger={
                                  <span className="issuetrigger">
                                    <span
                                      className={
                                        "signal " + (!pend ? "positive" : "")
                                      }
                                    >
                                      {pend ? (
                                        <CircleAlert size={16} />
                                      ) : (
                                        <CircleCheck size={16} />
                                      )}
                                    </span>
                                    <span className="issuebody">
                                      <span className="issuetitle">
                                        <b>{x.title}</b>
                                        {active && pend ? (
                                          <Badge
                                            variant="warning"
                                            label="Em revisão"
                                          />
                                        ) : !pend ? (
                                          <Badge
                                            variant="success"
                                            label="Pronta"
                                          />
                                        ) : null}
                                      </span>
                                      <small>
                                        NF {x.nf || "sem número"} <i /> Pág.{" "}
                                        {o.paginas.join(", ")}
                                      </small>
                                    </span>
                                  </span>
                                }
                              >
                                <div className="issuedesc">
                                  <p>{x.motivo}</p>
                                  {active &&
                                  modal === "editar" &&
                                  inlineEditor &&
                                  op ? (
                                    <Editor
                                      rascunho={emVisita ? undefined : rascunho}
                                      inline
                                      key={op.id + campo}
                                      r={r}
                                      op={op}
                                      campo={campo}
                                      close={() => setModal("")}
                                      done={corrected}
                                      conflict={conflito}
                                    />
                                  ) : (
                                    <>
                                      <div className="fieldpair">
                                        <span>
                                          <FileSearch size={14} />{" "}
                                          {rotulo(active ? campo : x.c)}
                                        </span>
                                        <strong>
                                          {valor(o, active ? campo : x.c) ||
                                            "Em branco"}
                                        </strong>
                                      </div>
                                      <div className="issueactions">
                                        {irParaPdf}
                                        {podeEditar && (
                                          <Btn
                                            label="Corrigir campo"
                                            data-roteiro="corrigir"
                                            tooltip={dicas.corrigir}
                                            size="sm"
                                            icon={<Pencil size={14} />}
                                            onClick={() => setModal("editar")}
                                          />
                                        )}
                                        <Btn
                                          label="Ver todos os campos"
                                          tooltip={dicas.campos}
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setParte(campo);
                                            setModal("campos");
                                          }}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </Collapsible>
                            </Card>
                          );
                        })}
                        {!linhas.length && (
                          <div className="empty small">
                            {q.length || busca ? <Search /> : <CheckCheck />}
                            <b>
                              {busca
                                ? "Nenhuma ocorrência encontrada"
                                : q.length
                                  ? "Sem ocorrências nesta lista"
                                  : "Nenhuma pendência"}
                            </b>
                          </div>
                        )}
                      </div>
                      {totalPaginas > 1 && (
                        <nav
                          className="filapaginacao"
                          aria-label="Páginas de ocorrências"
                        >
                          <Btn
                            size="sm"
                            variant="ghost"
                            label="Página anterior de ocorrências"
                            tooltip="Página anterior de ocorrências"
                            isIconOnly
                            icon={
                              <ChevronRight
                                size={15}
                                style={{ transform: "rotate(180deg)" }}
                              />
                            }
                            isDisabled={paginaAtual === 0}
                            onClick={() => setPaginaFila(paginaAtual - 1)}
                          />
                          <span aria-live="polite">
                            {paginaAtual + 1} de {totalPaginas}
                          </span>
                          <Btn
                            size="sm"
                            variant="ghost"
                            label="Próxima página de ocorrências"
                            tooltip="Próxima página de ocorrências"
                            isIconOnly
                            icon={<ChevronRight size={15} />}
                            isDisabled={paginaAtual + 1 === totalPaginas}
                            onClick={() => setPaginaFila(paginaAtual + 1)}
                          />
                        </nav>
                      )}
                      {op &&
                        !linhas.some(
                          (x) =>
                            x.id === opId &&
                            (filtro === "todas" || x.c === campo),
                        ) && (
                          <div className="detail">
                            <div className="detailtitle">
                              <small>Campo selecionado</small>
                              <span>Op. {op.id}</span>
                            </div>
                            <strong>{rotulo(campo)}</strong>
                            <p>
                              {selected?.motivo ||
                                "Confira os dados extraídos no relatório original."}
                            </p>
                            <div className="readrow">
                              <span>Valor atual</span>
                              <code>{valor(op, campo) || "Em branco"}</code>
                            </div>
                            {podeEditar && (
                              <Btn
                                label="Corrigir campo"
                                tooltip={dicas.corrigir}
                                variant="primary"
                                icon={<Pencil size={15} />}
                                onClick={() => setModal("editar")}
                              />
                            )}
                            <Tooltip
                              content={dicas.campos}
                              focusTrigger="always"
                            >
                              <button
                                className="textlink"
                                onClick={() => {
                                  setParte(campo);
                                  setModal("campos");
                                }}
                              >
                                Ver todos os campos <ChevronRight size={14} />
                              </button>
                            </Tooltip>
                            {irParaPdf}
                          </div>
                        )}
                    </Card>
                    <Card padding={0} className="panel preview">
                      <div className="panelhead">
                        <div>
                          <h2 id="previa-relatorio" tabIndex={-1}>
                            Prévia do relatório
                          </h2>
                          <p>
                            {op
                              ? "Nota fiscal " +
                                (valor(op, "nf") || "sem número") +
                                " · Operação " +
                                op.id
                              : "Documento da filial"}
                          </p>
                        </div>
                        <span className="squareicon">
                          <FileSearch size={19} />
                        </span>
                        <a className="paneljump" href="#fila-revisao">
                          Voltar à revisão
                        </a>
                      </div>
                      <TabList
                        role="tablist"
                        aria-label="Visualização do relatório"
                        size="sm"
                        layout="fill"
                        hasDivider
                        value={tab}
                        onChange={(v) => setTab(v as "pdf" | "dados")}
                      >
                        <Tooltip
                          content="Veja o relatório enviado pela filial na página desta nota. Use o documento para conferir a informação."
                          placement="above"
                          focusTrigger="always"
                        >
                          <Tab
                            value="pdf"
                            label="PDF original"
                            icon={<FileText size={15} />}
                            panelId="area-previa"
                          />
                        </Tooltip>
                        <Tooltip
                          content="Compare os valores lidos no PDF com os valores atuais da operação."
                          placement="above"
                          focusTrigger="always"
                        >
                          <Tab
                            value="dados"
                            label="Dados extraídos"
                            icon={<Table2 size={15} />}
                            panelId="area-previa"
                          />
                        </Tooltip>
                      </TabList>
                      <div
                        id="area-previa"
                        role="tabpanel"
                        aria-label="Prévia selecionada"
                      >
                        {tab === "pdf" ? (
                          <Documento
                            ilustrativo={emVisita && r === exemplo}
                            lote={r.lote}
                            op={op}
                            campo={campo}
                            pagina={pagina}
                            setPagina={setPagina}
                          />
                        ) : (
                          <Dados
                            op={op}
                            campo={campo}
                            onCampo={(c) => seleCampo(c)}
                          />
                        )}
                      </div>
                    </Card>
                  </div>
                  {r.lote.estado !== "CONFERENCIA" && (
                    <div className="panel workflow">
                      <div>
                        <small>FECHAMENTO</small>
                        <h3>{estados[r.lote.estado]}</h3>
                      </div>
                      <Btn
                        variant="secondary"
                        label="Baixar TXT"
                        icon={<Download size={16} />}
                        onClick={() => download()}
                      />
                      {r.lote.estado === "EXPORTADO" ? (
                        <Btn
                          label="Registrar processamento"
                          onClick={() => setModal("processamento")}
                        />
                      ) : (
                        <>
                          {r.lote.estado === "PROCESSADO" && (
                            <Btn
                              label="Registrar recibo"
                              onClick={() => setModal("recibo")}
                            />
                          )}
                          <Btn
                            variant="secondary"
                            label="Reabrir lote"
                            onClick={() => setModal("reabrir")}
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            {view === "conferencia" && !r && !loading && (
              <div className="panel empty">
                <ClipboardCheck />
                <h3>Selecione um lote para conferir</h3>
                <Btn label="Abrir lotes" onClick={() => move("lotes")} />
              </div>
            )}
            {viewAtual === "lotes" && !loading && (
              <Activity mode={emVisita ? "hidden" : "visible"}>
                <Arquivo
                  lotes={lista}
                  abrir={abrirLote}
                  criar={() => setModal("import")}
                  roteiro={iniciarRoteiro}
                />
              </Activity>
            )}
            {view === "historico" && (!loading || emVisita) && (
              <Historico
                ilustrativo={emVisita && r === exemplo}
                key={(r?.lote.id || "vazio") + "-" + (r?.lote.versao || 0)}
                lote={r?.lote}
                lotes={lista}
                trocar={(id) => abrirLote(id, "historico")}
                criar={() => setModal("import")}
                arquivo={() => move("lotes")}
                baixar={download}
              />
            )}
            {viewAtual === "guia" && (
              <Activity mode={emVisita ? "hidden" : "visible"}>
                <Guia
                  criar={() => setModal("import")}
                  conferir={() => move("conferencia")}
                  previa={() => setModal("txt")}
                  historico={() => move("historico")}
                  temLote={!!r}
                />
              </Activity>
            )}
            {modal === "import" && (
              <ImportForm
                naPagina={emVisita}
                cancel={() => setModal("")}
                done={(res) => {
                  setModal("");
                  apply(res);
                  setLista((p) => [
                    res.lote,
                    ...p.filter((l) => l.id !== res.lote.id),
                  ]);
                  move("conferencia");
                  setToast("Lote disponível em Meus lotes.");
                }}
              />
            )}
            {modal === "txt" && r && (
              <Modal
                naPagina={emVisita}
                titulo="Prévia do TXT"
                close={() => !wait && setModal("")}
              >
                <div className="form">
                  <div className="contextline">
                    {periodo(r.lote.competencia)} · {cnpjFormatado(r.lote.cnpj)}
                  </div>
                  {q.length ? (
                    <PendenciasTxt
                      pendencias={q}
                      operacoes={operacoesPorId}
                      revisar={(p) => {
                        move("conferencia");
                        mostrarPendencia(p, r);
                        setModal("");
                        setTab("pdf");
                      }}
                    />
                  ) : (
                    <>
                      <p>
                        Confira o conteúdo abaixo. Ao exportar, o arquivo .txt
                        será salvo na sua pasta Downloads.
                      </p>
                      {txt ? (
                        <pre className="txtcode">{txt}</pre>
                      ) : (
                        !txtError && <p>Preparando prévia…</p>
                      )}
                      {txtError && (
                        <p role="alert" className="errmsg">
                          {txtError}
                        </p>
                      )}
                    </>
                  )}
                  <Btn
                    label={wait ? "Gerando…" : "Exportar TXT"}
                    data-roteiro="exportar"
                    icon={<Download size={16} />}
                    isDisabled={q.length > 0 || !txt || wait}
                    onClick={exportar}
                  />
                </div>
              </Modal>
            )}
            <footer className="foot">
              <div className="rodape-versao">
              <span>
                © {new Date().getFullYear()} Rodogarcia. Todos os direitos
                reservados.
              </span>
              <Atualizacao ocupado={Boolean(modal) || passo !== null} />
              </div>
              <div className="credits">
                <span>
                  Sistema criado por{" "}
                  <Tooltip content="Abrir o LinkedIn de Lucas Andrade">
                    <a
                      href="https://www.linkedin.com/in/dev-lucasandrade/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lucas Andrade
                      <SquareArrowOutUpRight size={13} aria-hidden="true" />
                      <VisuallyHidden>
                        {" "}
                        no LinkedIn (abre em nova aba)
                      </VisuallyHidden>
                    </a>
                  </Tooltip>
                </span>
                <i />
                <Tooltip content="Enviar e-mail para o suporte">
                  <a href="mailto:lucasmac.dev@gmail.com">
                    <Mail size={14} />
                    lucasmac.dev@gmail.com
                  </a>
                </Tooltip>
              </div>
            </footer>
          </main>
        </div>
        {toast && (
          <div role="status" className="toast">
            <Check size={16} />
            {toast}
          </div>
        )}
        {modal === "editar" && !inlineEditor && r && op && (
          <Editor
            rascunho={rascunho}
            r={r}
            op={op}
            campo={campo}
            close={() => setModal("")}
            done={corrected}
            conflict={conflito}
          />
        )}
        {modal === "campos" && op && (
          <Modal titulo="Campos da operação" close={() => setModal("")}>
            <div className="form">
              <label>
                Escolher campo
                <select
                  aria-describedby="orientacao-campo"
                  value={parte}
                  onChange={(e) => setParte(e.target.value)}
                >
                  {todosCampos.map((k) => (
                    <option key={k} value={k}>
                      {rotulo(k)}
                    </option>
                  ))}
                </select>
              </label>
              <p id="orientacao-campo" className="fieldguide">
                {instrucao(parte)}
              </p>
              <div className="readvalue">
                <small>Valor atual</small>
                <strong>{valor(op, parte) || "Em branco"}</strong>
              </div>
              <Btn
                label={podeEditar ? "Editar este campo" : "Ver no relatório"}
                onClick={() => {
                  seleCampo(parte);
                  setModal(podeEditar ? "editar" : "");
                  setTab("pdf");
                }}
              />
            </div>
          </Modal>
        )}
        {["processamento", "recibo", "reabrir"].includes(modal) && r && (
          <Movimento
            r={r}
            acao={modal}
            close={() => setModal("")}
            done={(res) => {
              record(res);
              setToast("Histórico atualizado.");
            }}
          />
        )}
      </div>
    </Theme>
  );
}
