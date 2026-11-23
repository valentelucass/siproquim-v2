import { useEffect, useRef, useState } from "react";
import { Switch } from "@astryxdesign/core/Switch";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Table, proportional } from "@astryxdesign/core/Table";
import { Button } from "@astryxdesign/core/Button";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import {
  getDocument,
  GlobalWorkerOptions,
  Util,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ScanLine,
  ScanText,
  FileText,
  Download,
} from "lucide-react";
import {
  resposta,
  baixar,
  valor,
  rotulo,
  problema,
  type Operacao,
  type Lote,
} from "./api";
GlobalWorkerOptions.workerSrc = workerUrl;

import { localizar } from "./localizar";
export function Documento({
  ilustrativo = false,
  lote,
  op,
  campo,
  pagina,
  setPagina,
}: {
  ilustrativo?: boolean;
  lote: Lote;
  op?: Operacao;
  campo: string;
  pagina: number;
  setPagina: (n: number) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState("");
  const [escala, zoom] = useState(1);
  const [largura, setLargura] = useState(450);
  const [mark, setMark] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [pronto, setPronto] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [destacar, setDestacar] = useState(true);
  const [originais, setOriginais] = useState(false);
  const [dim, setDim] = useState({ width: 440, height: 490 });
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([r]) =>
      setLargura(Math.max(200, r.contentRect.width - 36)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let loading: ReturnType<typeof getDocument> | undefined;
    let active = true;
    setPdf(undefined);
    setError("");
    setPronto(false);
    setMark(null);
    if (lote.paginas)
      (ilustrativo
        ? fetch("/fretes-demonstracao.pdf", { signal: abort.signal })
        : resposta("/lotes/" + lote.id + "/pdf", { signal: abort.signal })
      )
        .then((r) => r.arrayBuffer())
        .then((data) => {
          if (!active) return;
          loading = getDocument({ data, useSystemFonts: true });
          return loading.promise;
        })
        .then((d) => {
          if (active && d) setPdf(d);
        })
        .catch((e) => {
          if (active) setError(problema(e, "Abrir PDF"));
        });
    return () => {
      active = false;
      abort.abort();
      if (loading) void loading.destroy();
    };
  }, [lote.id, lote.paginas, ilustrativo]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let task:
      | ReturnType<Awaited<ReturnType<typeof pdf.getPage>>["render"]>
      | undefined;
    const el = canvas.current;
    setPronto(false);
    setMark(null);
    (async () => {
      const p = await pdf.getPage(pagina);
      if (!active) return;
      const unit = p.getViewport({ scale: 1 });
      const v = p.getViewport({
        scale: Math.min(largura / unit.width, 1.3) * escala,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.ceil(v.width * dpr);
      el.height = Math.ceil(v.height * dpr);
      setDim({ width: v.width, height: v.height });
      task = p.render({
        canvas: el,
        viewport: v,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      await task.promise;
      if (!active) return;
      let rect = null;
      if (op && op.paginas.includes(pagina) && campo) {
        const content = await p.getTextContent();
        if (!active) return;
        const item = localizar(
          content.items.filter(
            (t): t is TextItem => "str" in t && !!t.str.trim(),
          ),
          op,
          campo,
        );
        if (item) {
          const m = Util.transform(v.transform, item.transform);
          const h = Math.hypot(m[2], m[3]);
          rect = {
            left: Math.max(0, m[4] - 3),
            top: m[5] - h - 2,
            width: item.width * v.scale + 10,
            height: h + 6,
          };
        }
      }
      setMark(rect);
      setPronto(true);
      if (area.current) {
        const box = area.current;
        box.scrollTop = rect
          ? Math.max(0, rect.top - box.clientHeight * 0.7)
          : 0;
        box.scrollLeft = 0;
      }
    })().catch((e) => {
      if (active && e.name !== "RenderingCancelledException")
        setError(problema(e, "Renderizar página do PDF"));
    });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [pdf, pagina, largura, escala, op, campo]);
  async function baixarPdf() {
    try {
      baixar(
        await (await resposta("/lotes/" + lote.id + "/pdf")).blob(),
        lote.nome,
      );
    } catch (e) {
      setError(problema(e, "Baixar PDF"));
    }
  }
  if (!lote.paginas)
    return (
      <div className="empty">
        <FileText />
        <h3>Lote sem movimento</h3>
        <p>A ausência de fretes foi declarada com evidência.</p>
      </div>
    );
  return (
    <>
      <div className="filebar">
        <span>
          <FileText size={15} />
          <b>{lote.nome}</b>
        </span>
        <Tooltip
          content="Salve uma cópia do relatório que a filial enviou."
          focusTrigger="always"
        >
          <button
            className="icon"
            aria-label="Baixar PDF original"
            onClick={baixarPdf}
          >
            <Download size={17} />
          </button>
        </Tooltip>
      </div>
      <div
        className="canvasarea"
        ref={area}
        aria-label="Visualização do PDF original"
      >
        {error ? (
          <div className="empty" role="alert">
            {error}
          </div>
        ) : (
          <div
            className={"sheet" + (originais ? " cores-originais" : "")}
            ref={sheet}
            style={dim}
          >
            {!pronto && (
              <div className="pdfloading">
                <Skeleton width="90%" height={18} />
                <Skeleton width="65%" height={12} />
              </div>
            )}
            <canvas
              ref={canvas}
              aria-label={"PDF original, página " + pagina}
              style={{ width: dim.width, height: dim.height }}
            />
            {mark && destacar && (
              <span
                data-testid="destaque-pdf"
                aria-label={"Local do campo " + rotulo(campo)}
                className="pdfmark"
                style={mark}
              />
            )}
          </div>
        )}
      </div>
      <div className="pdfcontrols">
        <span>
          <Tooltip content="Página anterior">
            <button
              className="icon"
              aria-label="Página anterior"
              disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
          <b>{pagina}</b> / {lote.paginas}
          <Tooltip content="Próxima página">
            <button
              className="icon"
              aria-label="Próxima página"
              disabled={pagina >= lote.paginas}
              onClick={() => setPagina(pagina + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>
        </span>
        <span>
          <Tooltip content="Diminuir zoom">
            <button
              className="icon"
              aria-label="Diminuir zoom"
              disabled={escala <= 0.75}
              onClick={() => zoom((z) => Math.max(0.75, z - 0.25))}
            >
              <Minus size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Restaurar zoom">
            <button
              className="texticon"
              aria-label="Restaurar zoom"
              onClick={() => zoom(1)}
            >
              {Math.round(escala * 100)}%
            </button>
          </Tooltip>
          <Tooltip content="Aumentar zoom">
            <button
              className="icon"
              aria-label="Aumentar zoom"
              disabled={escala >= 2.5}
              onClick={() => zoom((z) => Math.min(2.5, z + 0.25))}
            >
              <Plus size={15} />
            </button>
          </Tooltip>
        </span>
      </div>
      <div className="locator">
        <Switch
          size="sm"
          label="Destacar campo"
          value={destacar}
          onChange={setDestacar}
        />
        <span className="darkoption">
          <Switch
            size="sm"
            label="Cores originais"
            value={originais}
            onChange={setOriginais}
          />
        </span>
        <span className="vline" />
        {mark ? <ScanLine size={15} /> : <ScanText size={15} />}
        <span>
          {mark
            ? destacar
              ? "Campo localizado no PDF"
              : "Destaque desativado"
            : !pronto
              ? "Carregando página…"
              : op?.paginas.includes(pagina)
                ? "Página da operação. Confira o campo visualmente."
                : "Página em consulta"}
        </span>
      </div>
    </>
  );
}
export function Dados({
  op,
  campo,
  onCampo,
}: {
  op?: Operacao;
  campo: string;
  onCampo: (c: string) => void;
}) {
  if (!op) return <p className="empty">Sem operação selecionada.</p>;
  const dados = Object.keys({ ...op.original, ...op.ajustes })
    .sort((a, b) => rotulo(a).localeCompare(rotulo(b), "pt-BR"))
    .map((key) => ({
      key,
      campo: rotulo(key),
      original: op.original[key] || "Em branco",
      atual: valor(op, key) || "Em branco",
    }));
  return (
    <div className="datafields">
      <Table
        aria-label="Dados extraídos da operação"
        density="compact"
        data={dados}
        columns={[
          {
            key: "campo",
            header: "Campo",
            width: proportional(1),
            renderCell: (row) => (
              <Button
                size="sm"
                variant={row.key === campo ? "secondary" : "ghost"}
                label={row.campo}
                tooltip="Selecionar este campo para conferência"
                onClick={() => onCampo(row.key)}
              />
            ),
          },
          { key: "original", header: "Lido no PDF", width: proportional(1) },
          { key: "atual", header: "Valor atual", width: proportional(1) },
        ]}
      />
    </div>
  );
}
