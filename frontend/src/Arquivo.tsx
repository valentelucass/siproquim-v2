import { useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Table, proportional } from "@astryxdesign/core/Table";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import {
  Archive,
  ClipboardCheck,
  Download,
  FileClock,
  FileText,
  ListStart,
  FolderOpen,
  History,
  Paperclip,
  Plus,
  Search,
} from "lucide-react";
import {
  cnpjFormatado,
  estados,
  ler,
  periodo,
  problema,
  rotulo,
  type Evento,
  type Resumo,
} from "./api";
export function Arquivo({
  lotes,
  abrir,
  criar,
  roteiro,
}: {
  lotes: Resumo[];
  abrir: (id: string) => void;
  criar: () => void;
  roteiro: () => void;
}) {
  const [busca, setBusca] = useState(""),
    [estado, setEstado] = useState("");
  const dados = lotes
    .filter(
      (l) =>
        (!estado || l.estado === estado) &&
        [
          l.nome,
          l.cnpj,
          cnpjFormatado(l.cnpj),
          l.competencia,
          periodo(l.competencia),
        ]
          .join(" ")
          .toLowerCase()
          .includes(busca.trim().toLowerCase()),
    )
    .map((l) => ({ ...l }));
  return (
    <Card padding={0} className="archivepage">
      <div className="archivehead">
        <div className="headingicon">
          <Archive />
          <div>
            <h2>Arquivo de lotes</h2>
            <p>Relatórios agrupados por filial e competência.</p>
          </div>
        </div>
        <Badge
          variant="neutral"
          label={lotes.length === 1 ? "1 lote" : lotes.length + " lotes"}
        />
      </div>
      {!lotes.length ? (
        <div className="onboard">
          <div className="welcomeicon">
            <FolderOpen size={32} />
          </div>
          <h3>Importe seu primeiro lote</h3>
          <p>
            Escolha a filial na lista, informe o mês dos fretes e selecione o
            PDF.
          </p>
          <div className="onboardactions">
            <Button
              label="Importar relatório"
              icon={<Plus size={16} />}
              onClick={criar}
            />
            <Button
              label="Ver passo a passo"
              icon={<ListStart size={16} />}
              variant="secondary"
              onClick={roteiro}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="filters">
            <TextInput
              label="Buscar lote"
              isLabelHidden
              startIcon={<Search size={16} />}
              placeholder="Buscar arquivo, CNPJ ou competência"
              value={busca}
              onChange={setBusca}
              hasClear
            />
            <label>
              Situação{" "}
              <select
                aria-label="Situação"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todas</option>
                {Object.entries(estados).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {dados.length ? (
            <div className="lotstable">
              <Table
                aria-label="Lotes importados"
                data={dados}
                density="compact"
                columns={[
                  {
                    key: "nome",
                    header: "Relatório",
                    width: proportional(2),
                    renderCell: (l) => (
                      <Button
                        size="sm"
                        label={l.nome}
                        icon={<FileText size={15} />}
                        variant="ghost"
                        onClick={() => abrir(l.id)}
                      />
                    ),
                  },
                  {
                    key: "cnpj",
                    header: "Filial declarante",
                    width: proportional(1),
                    renderCell: (l) => cnpjFormatado(l.cnpj),
                  },
                  {
                    key: "competencia",
                    header: "Competência",
                    width: proportional(1),
                    renderCell: (l) => periodo(l.competencia),
                  },
                  {
                    key: "estado",
                    header: "Situação",
                    width: proportional(1),
                    renderCell: (l) => (
                      <Badge
                        label={estados[l.estado]}
                        variant={
                          l.estado === "CONFERENCIA" ? "neutral" : "success"
                        }
                      />
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="onboard">
              <Search />
              <h3>Nenhum lote corresponde aos filtros</h3>
              <Button
                label="Limpar filtros"
                variant="secondary"
                onClick={() => {
                  setBusca("");
                  setEstado("");
                }}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
const eventos: Record<string, string> = {
  IMPORTADO: "PDF importado",
  CORRIGIDO: "Campo corrigido",
  EXPORTADO: "TXT exportado",
  PROCESSAMENTO_INFORMADO: "Processamento informado",
  RECIBO_INFORMADO: "Recibo registrado",
  REABERTO: "Lote reaberto",
  SEM_MOVIMENTO_DECLARADO: "Mês sem movimento",
};
export function Historico({
  ilustrativo = false,
  lote,
  lotes,
  trocar,
  arquivo,
  criar,
  baixar,
}: {
  ilustrativo?: boolean;
  lote?: Resumo;
  lotes: Resumo[];
  trocar: (id: string) => void;
  arquivo: () => void;
  criar: () => void;
  baixar: (v: number, pdf?: boolean) => void;
}) {
  const [movs, setMovs] = useState<Evento[]>(),
    [error, setError] = useState("");
  useEffect(() => {
    if (!lote) return;
    if (ilustrativo) {
      setMovs([
        {
          versao: 1,
          evento: "IMPORTADO",
          evidencia: lote.nome,
          alteracoes: "{}",
          temAnexo: false,
          instante: "2026-10-31T12:00:00Z",
        },
      ]);
      return;
    }
    const abort = new AbortController();
    ler<Evento[]>("/lotes/" + lote.id + "/historico", {
      signal: abort.signal,
    })
      .then((r) => setMovs(r.reverse()))
      .catch((e) => {
        if (!abort.signal.aborted) setError(problema(e));
      });
    return () => abort.abort();
  }, [lote?.id, lote?.versao, ilustrativo]);
  if (!lote)
    return (
      <Card padding={0} className="archivepage">
        <div className="archivehead">
          <div className="headingicon">
            <History />
            <div>
              <h2>Histórico de alterações</h2>
              <p>Correções, exportações e protocolos de um lote.</p>
            </div>
          </div>
        </div>
        <div className="onboard">
          <div className="welcomeicon">
            <FileClock size={32} />
          </div>
          <h3>Nenhum lote selecionado</h3>
          <p>
            {lotes.length
              ? "Escolha qual relatório deseja consultar."
              : "O histórico aparece assim que você importa o primeiro relatório."}
          </p>
          <Button
            label={lotes.length ? "Escolher lote" : "Criar primeiro lote"}
            onClick={lotes.length ? arquivo : criar}
            icon={<FolderOpen size={16} />}
          />
        </div>
      </Card>
    );
  return (
    <Card padding={0} className="archivepage">
      <div className="archivehead">
        <div className="headingicon">
          <FileClock />
          <div>
            <h2>{lote.nome}</h2>
            <p>
              {cnpjFormatado(lote.cnpj)} · {periodo(lote.competencia)}
            </p>
          </div>
        </div>
        {lotes.length > 1 ? (
          <label className="choosefile">
            Lote{" "}
            <select value={lote.id} onChange={(e) => trocar(e.target.value)}>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} · {l.competencia}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Badge variant="neutral" label={estados[lote.estado]} />
        )}
      </div>
      <div className="histbody">
        <h3>Atividade do lote</h3>
        {error ? (
          <Banner role="alert" status="error" title={error} />
        ) : !movs ? (
          <Skeleton width="100%" height={54} />
        ) : (
          <ol className="timeline">
            {movs.map((e) => {
              let d: Record<string, unknown> = {};
              try {
                d = JSON.parse(e.alteracoes);
              } catch {
                /* Evento antigo sem detalhe. */
              }
              return (
                <li key={e.versao}>
                  <span className="eventicon">
                    {e.evento === "CORRIGIDO" ? (
                      <ClipboardCheck size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </span>
                  <div>
                    <div className="eventtitle">
                      <strong>{eventos[e.evento] || e.evento}</strong>
                      <Badge variant="neutral" label={"Versão " + e.versao} />
                    </div>
                    <time>{new Date(e.instante).toLocaleString("pt-BR")}</time>
                    <p>{e.evidencia}</p>
                    {!!d.antes &&
                      Object.entries(d.antes as Record<string, string>).map(
                        ([k, v]) => (
                          <p className="diff" key={k}>
                            {rotulo(k)} · {v || "Em branco"} →{" "}
                            {String(
                              (d.depois as Record<string, string>)?.[k] ||
                                "Em branco",
                            )}
                          </p>
                        ),
                      )}
                    {e.evento === "RECIBO_INFORMADO" && (
                      <>
                        <p>
                          Protocolo {String(d.protocolo)} ·{" "}
                          {String(d.dataProtocolo || "Data sem registro")}
                        </p>
                        <div className="issueactions">
                          <Button
                            size="sm"
                            icon={<Download size={14} />}
                            label="TXT desta versão"
                            onClick={() => baixar(e.versao)}
                          />
                          {e.temAnexo && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Paperclip size={14} />}
                              label="Consultar anexo"
                              onClick={() => baixar(e.versao, true)}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
