import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type RefObject,
} from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Selector } from "@astryxdesign/core/Selector";
import { FieldLabel } from "@astryxdesign/core/Field";
import { cnpjFormatado } from "./api";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Button } from "@astryxdesign/core/Button";
import { UploadCloud, FileText, Check, Info, Paperclip } from "lucide-react";
import {
  alterar,
  importar,
  ler,
  escolhas,
  instrucao,
  rotulo,
  valor,
  problema,
  type Resultado,
  type Operacao,
} from "./api";
export const Btn = Button;
const LIMITE_EVIDENCIA = 1000;

function Evidencia({
  label,
  dica,
  exemplo,
  value,
  onChange,
}: {
  label: string;
  dica: string;
  exemplo: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextArea
      label={label}
      labelTooltip={dica}
      placeholder={exemplo}
      isRequired
      value={value}
      onChange={onChange}
      status={
        value.length > LIMITE_EVIDENCIA
          ? {
              type: "error",
              message: "Resuma a referência em até 1.000 caracteres.",
            }
          : undefined
      }
    />
  );
}
export function Modal({
  naPagina = false,
  titulo,
  close,
  children,
}: {
  naPagina?: boolean;
  titulo: string;
  close: () => void;
  children: ReactNode;
}) {
  if (naPagina)
    return (
      <section className="panel roteiro-formulario" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
      </section>
    );
  return (
    <Dialog
      isOpen
      className="sipro-dialog"
      width={540}
      purpose="info"
      padding={0}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <div className="dialog-titlebar">
        <DialogHeader
          title={titulo}
          onOpenChange={(v) => {
            if (!v) close();
          }}
        />
      </div>
      {children}
    </Dialog>
  );
}
export function ImportForm({
  naPagina = false,
  done,
  cancel,
}: {
  naPagina?: boolean;
  done: (r: Resultado) => void;
  cancel: () => void;
}) {
  const [filiais, setFiliais] = useState<
    { cnpj: string; sigla: string; empresa: string }[]
  >([]);
  const [carga, recarregar] = useState(0);
  const [erroFiliais, setErroFiliais] = useState("");
  const [cnpj, setCnpj] = useState(""),
    [comp, setComp] = useState(""),
    [file, setFile] = useState<File>(),
    [sem, setSem] = useState(false),
    [ev, setEv] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setErroFiliais("");
    ler<typeof filiais>("/filiais", { signal: abort.signal })
      .then((lista) => {
        if (abort.signal.aborted) return;
        setFiliais(lista);
        try {
          const ultima = localStorage.getItem("sipro.filial");
          if (ultima && lista.some((f) => f.cnpj === ultima)) setCnpj(ultima);
        } catch {
          /* O seletor também funciona sem preferências locais. */
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setErroFiliais(problema(e));
      });
    return () => abort.abort();
  }, [carga]);
  const ref = useRef<HTMLInputElement>(null);
  const [leitura, setLeitura] = useState<{
    arquivo: File;
    url?: string;
    erro?: string;
  }>();
  const fileUrl = leitura?.arquivo === file ? leitura?.url : undefined;
  const erroArquivo = leitura?.arquivo === file ? leitura?.erro : undefined;
  const [ver, mostrar] = useState(false);
  useEffect(() => {
    mostrar(false);
    if (!file) return;
    let atual = true;
    let url: string | undefined;
    file
      .slice(0, 1024)
      .text()
      .then((inicio) => {
        if (!atual) return;
        if (!inicio.includes("%PDF-")) {
          setLeitura({
            arquivo: file,
            erro: "Escolha um PDF do relatório de fretes. O arquivo selecionado tem outro formato.",
          });
          return;
        }
        url = URL.createObjectURL(file.slice(0, file.size, "application/pdf"));
        setLeitura({ arquivo: file, url });
      })
      .catch(() => {
        if (atual)
          setLeitura({
            arquivo: file,
            erro: "Não foi possível ler o arquivo. Escolha o PDF novamente.",
          });
      });
    return () => {
      atual = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!filiais.some((f) => f.cnpj === cnpj))
        throw Error("Selecione a filial declarante.");
      if (!sem && (!file || !fileUrl))
        throw Error("Selecione um relatório PDF válido.");
      const r = sem
        ? await alterar<Resultado>("/lotes/sem-movimento", {
            cnpj,
            competencia: comp,
            evidencia: ev,
          })
        : await importar(file!, cnpj, comp);
      try {
        localStorage.setItem("sipro.filial", cnpj);
      } catch {
        /* Preferência opcional. */
      }
      done(r);
    } catch (e) {
      setError(problema(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      naPagina={naPagina}
      titulo="Novo lote"
      close={() => !busy && cancel()}
    >
      <form onSubmit={submit} className="modalform">
        <div className="form">
          <p>
            Escolha a filial e o mês em que o frete foi realizado. O relatório
            ficará disponível em Meus lotes.
          </p>
          <div className="formgrid">
            <div className="filialfield">
              <Selector
                label="Filial declarante"
                labelTooltip="Escolha a unidade responsável por este relatório. Você pode buscar pela sigla ou pelo nome. O CNPJ aparece após a seleção."
                isRequired
                value={cnpj}
                onChange={setCnpj}
                options={filiais.map((f) => ({
                  value: f.cnpj,
                  label: f.sigla + " · " + f.empresa,
                  description: cnpjFormatado(f.cnpj),
                }))}
                placeholder="Selecione a filial"
                hasSearch
                searchPlaceholder="Buscar filial ou empresa"
                isLoading={!filiais.length && !erroFiliais}
              />
              {cnpj && (
                <output aria-label="CNPJ da filial selecionada">
                  {cnpjFormatado(cnpj)}
                </output>
              )}
            </div>
            <div className="monthfield">
              <FieldLabel
                label="Competência"
                inputID="mes-do-frete"
                labelTooltip="Escolha o mês em que o frete foi realizado. Por exemplo, para fretes de janeiro de 2026, escolha janeiro de 2026."
              />
              <input
                id="mes-do-frete"
                type="month"
                required
                value={comp}
                onChange={(e) => setComp(e.target.value)}
              />
            </div>
          </div>
          {erroFiliais && (
            <Banner
              role="alert"
              status="error"
              title="Não foi possível carregar as filiais."
              endContent={
                <Btn
                  type="button"
                  size="sm"
                  label="Tentar novamente"
                  onClick={() => recarregar((n) => n + 1)}
                />
              }
            />
          )}
          <CheckboxInput
            label="Declarar mês sem movimento"
            description="Marque se a filial não teve fretes a declarar no mês escolhido."
            value={sem}
            onChange={setSem}
          />
          {sem ? (
            <Evidencia
              label="Evidência da conferência"
              dica="Indique o que você consultou para confirmar que a filial não teve fretes a declarar nesse mês."
              exemplo="Ex.: relatório mensal da filial, consultado em 5 de fevereiro"
              value={ev}
              onChange={setEv}
            />
          ) : (
            <>
              <VisuallyHidden>
                <input
                  ref={ref}
                  tabIndex={-1}
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Relatório PDF"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </VisuallyHidden>
              <button
                type="button"
                className="dropfile"
                onClick={() => ref.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setFile(e.dataTransfer.files[0]);
                }}
              >
                <UploadCloud />
                {file ? file.name : "Solte o PDF aqui ou escolha o arquivo"}
              </button>
              {erroArquivo && (
                <Banner role="alert" status="error" title={erroArquivo} />
              )}
              {file && fileUrl && (
                <>
                  <Btn
                    type="button"
                    variant="ghost"
                    label={
                      ver ? "Fechar prévia do PDF" : "Ver PDF antes de importar"
                    }
                    onClick={() => mostrar(!ver)}
                  />
                  {ver && (
                    <iframe
                      className="importpreview"
                      title="Prévia antes da importação"
                      src={fileUrl}
                    />
                  )}
                </>
              )}
            </>
          )}
          {error && <Banner role="alert" status="error" title={error} />}
        </div>
        <div className="actions">
          <Btn
            type="button"
            label="Cancelar"
            variant="ghost"
            isDisabled={busy}
            onClick={cancel}
          />
          <Btn
            type="submit"
            label={busy ? "Lendo relatório…" : "Criar lote"}
            data-roteiro="criar"
            isDisabled={
              busy ||
              !cnpj ||
              !comp ||
              (sem ? !ev.trim() || ev.length > LIMITE_EVIDENCIA : !fileUrl)
            }
            icon={<FileText size={16} />}
          />
        </div>
      </form>
    </Modal>
  );
}
export type Rascunho = { chave: string; valor: string; fonte: string };
export function Editor({
  rascunho,
  r,
  op,
  campo,
  close,
  done,
  conflict,
  inline = false,
}: {
  inline?: boolean;
  rascunho?: RefObject<Rascunho | null>;

  r: Resultado;
  op: Operacao;
  campo: string;
  close: () => void;
  done: (r: Resultado) => void;
  conflict: () => void;
}) {
  const chave = [r.lote.id, r.lote.versao, op.id, campo].join("/");
  const inicial = rascunho?.current?.chave === chave ? rascunho.current : null;
  const [novo, mudar] = useState(inicial?.valor ?? valor(op, campo)),
    [ev, evidencia] = useState(inicial?.fonte ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sugs, setSugs] = useState<{ documento: string }[]>([]);
  const idCampo = useId();
  useEffect(() => {
    if (rascunho) rascunho.current = { chave, valor: novo, fonte: ev };
  }, [rascunho, chave, novo, ev]);
  useEffect(() => {
    if (!campo.endsWith("Doc")) return;
    let alive = true;
    const papel = campo.slice(0, -3);
    const query = new URLSearchParams({
      filial: r.lote.cnpj,
      papel,
      nome: valor(op, papel + "Nome"),
    });
    ler<{ documento: string }[]>("/memoria?" + query)
      .then((v) => {
        if (alive) setSugs(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [campo, op, r.lote.cnpj]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await alterar<Resultado>(
        "/lotes/" + r.lote.id + "/operacoes",
        {
          versao: r.lote.versao,
          operacao: op.id,
          campos: { [campo]: novo.trim() },
          evidencia: ev.trim(),
        },
        "PATCH",
      );
      done(result);
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && e.status === 409) {
        conflict();
        return;
      }
      setError(problema(e));
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <form className={inline ? "editor-inline" : "modalform"} onSubmit={save}>
      <div className="form">
        <div className="contextline">
          NF {valor(op, "nf")} <span>·</span> Pág. {op.paginas.join(", ")}{" "}
          <span>·</span> Operação {op.id}
        </div>
        <section className="readvalue">
          <small>Valor original no PDF</small>
          <strong>{op.original[campo] || "Em branco"}</strong>
        </section>
        <div className="editorfield">
          <label htmlFor={idCampo}>{rotulo(campo)}</label>
          {escolhas[campo] ? (
            <select
              id={idCampo}
              aria-describedby={idCampo + "-dica"}
              value={novo}
              onChange={(e) => mudar(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              {escolhas[campo].map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={idCampo}
              aria-describedby={idCampo + "-dica"}
              value={novo}
              autoFocus
              maxLength={500}
              onChange={(e) => mudar(e.target.value)}
              placeholder={
                campo.startsWith("data")
                  ? "dd/mm/aaaa"
                  : "Digite o valor conferido"
              }
            />
          )}
          <small id={idCampo + "-dica"} className="fieldguide">
            {instrucao(campo)}
          </small>
        </div>
        {sugs.length > 0 && (
          <div className="suggest">
            Sugestões confirmadas{" "}
            {sugs.map((s, i) => (
              <button type="button" key={i} onClick={() => mudar(s.documento)}>
                {s.documento}
              </button>
            ))}
          </div>
        )}
        <Evidencia
          label="Fonte da correção"
          dica="Diga onde encontrou o valor correto para que outra pessoa possa conferi-lo depois."
          exemplo="Ex.: comprovante de entrega, página e data"
          value={ev}
          onChange={evidencia}
        />
        {error && <Banner role="alert" status="error" title={error} />}
      </div>
      <div className="actions">
        <Btn
          label="Cancelar"
          type="button"
          variant="ghost"
          onClick={close}
          isDisabled={busy}
        />
        <Btn
          label={busy ? "Salvando…" : "Salvar correção"}
          data-roteiro="salvar"
          type="submit"
          icon={<Check size={16} />}
          isDisabled={
            busy ||
            !ev.trim() ||
            ev.length > LIMITE_EVIDENCIA ||
            novo.trim() === valor(op, campo)
          }
        />
      </div>
    </form>
  );
  return inline ? (
    form
  ) : (
    <Modal titulo="Corrigir campo" close={() => !busy && close()}>
      {form}
    </Modal>
  );
}
export function Movimento({
  r,
  acao,
  close,
  done,
}: {
  r: Resultado;
  acao: string;
  close: () => void;
  done: (r: Resultado) => void;
}) {
  const [ev, setEv] = useState(""),
    [pro, setPro] = useState(""),
    [data, setData] = useState(""),
    [file, setFile] = useState<File>(),
    [filial, setFilial] = useState(""),
    [mes, setMes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const recibo = acao === "recibo";
  const title = recibo
    ? "Registrar recibo"
    : acao === "reabrir"
      ? "Reabrir para retificação"
      : "Registrar processamento";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const base = "/lotes/" + r.lote.id + "/" + acao;
    const d = {
      versao: r.lote.versao,
      evidencia: ev,
      protocolo: pro,
      dataProtocolo: data.split("-").reverse().join("/"),
    };
    try {
      let res;
      if (recibo && file) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(d)) fd.set(k, String(v));
        fd.set("arquivo", file);
        fd.set("cnpj", filial);
        fd.set("competencia", mes);
        res = await ler<Resultado>(base, { method: "POST", body: fd });
      } else res = await alterar<Resultado>(base, d);
      done(res);
    } catch (e) {
      setError(problema(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titulo={title} close={() => !busy && close()}>
      <form className="modalform" onSubmit={submit}>
        <div className="form">
          <p className="note">
            <Info size={17} />
            {recibo
              ? "Transcreva os dados do recibo emitido pela PF."
              : acao === "reabrir"
                ? "A versão protocolada continua disponível no histórico."
                : "Confirme este passo depois de conferir o processamento no portal da PF."}
          </p>
          {recibo && (
            <>
              <label>
                Protocolo
                <input
                  required
                  value={pro}
                  onChange={(e) => setPro(e.target.value)}
                />
              </label>
              <label>
                Data do protocolo
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
              <label>
                <span>
                  <Paperclip size={14} /> PDF do recibo (opcional)
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
              {file && (
                <div className="formgrid">
                  <label>
                    CNPJ no recibo
                    <input
                      required
                      value={filial}
                      onChange={(e) => setFilial(e.target.value)}
                    />
                  </label>
                  <label>
                    Competência no recibo
                    <input
                      required
                      type="month"
                      value={mes}
                      onChange={(e) => setMes(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </>
          )}
          <Evidencia
            label="Evidência"
            value={ev}
            onChange={setEv}
            dica={
              recibo
                ? "Identifique o recibo que você consultou no portal da PF."
                : acao === "reabrir"
                  ? "Explique o que precisa mudar no lote já enviado."
                  : "Descreva o resultado que o portal da PF mostrou para este arquivo."
            }
            exemplo={
              recibo
                ? "Ex.: recibo do módulo Mapas, consultado em 10 de fevereiro"
                : acao === "reabrir"
                  ? "Ex.: o comprovante identifica outro recebedor na nota 123"
                  : "Ex.: arquivo processado no módulo Mapas em 10 de fevereiro"
            }
          />
          {error && <Banner role="alert" status="error" title={error} />}
        </div>
        <div className="actions">
          <Btn
            type="submit"
            isDisabled={busy || !ev.trim() || ev.length > LIMITE_EVIDENCIA}
            label={busy ? "Salvando…" : title}
          />
        </div>
      </form>
    </Modal>
  );
}
