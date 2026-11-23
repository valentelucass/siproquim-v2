import { useMemo, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { ChevronRight } from "lucide-react";
import { rotulo, valor, type Operacao, type Pendencia } from "./api";

export function PendenciasTxt({
  pendencias,
  operacoes,
  revisar,
}: {
  pendencias: Pendencia[];
  operacoes: ReadonlyMap<number, Operacao>;
  revisar: (p: Pendencia) => void;
}) {
  const [limite, setLimite] = useState(25);
  const [aba, setAba] = useState("revisar");
  const { porOperacao, revisarOps, prontas, motivos } = useMemo(() => {
    const porOperacao = new Map<number, Pendencia[]>();
    const porCampo = new Map<string, number>();
    for (const p of pendencias) {
      const grupo = porOperacao.get(p.operacao);
      if (grupo) grupo.push(p);
      else porOperacao.set(p.operacao, [p]);
      porCampo.set(p.campo, (porCampo.get(p.campo) ?? 0) + 1);
    }
    const revisarOps: Operacao[] = [];
    const prontas: Operacao[] = [];
    for (const op of operacoes.values()) {
      (porOperacao.has(op.id) ? revisarOps : prontas).push(op);
    }
    return { porOperacao, revisarOps, prontas, motivos: [...porCampo] };
  }, [pendencias, operacoes]);
  const total = operacoes.size;
  const lista = aba === "revisar" ? revisarOps : prontas;
  const progresso = prontas.length + " de " + total +
    (total === 1 ? " operação pronta." : " operações prontas.");
  return (
    <>
      <Banner
        status="warning"
        title={pendencias.length + (pendencias.length === 1 ? " campo" : " campos") + " para revisar"}
        description={progresso + " Revise os campos para salvar o TXT em Downloads."}
      />
      <ul className="txtmotivos" aria-label="Pendências por campo">
        {motivos.map(([campo, quantidade]) => (
          <li key={campo}>
            <span>{rotulo(campo)}</span> <strong>{quantidade}</strong>
          </li>
        ))}
      </ul>
      <TabList
        role="tablist"
        aria-label="Situação das operações"
        size="sm"
        layout="fill"
        hasDivider
        value={aba}
        onChange={(v) => {
          setAba(v);
          setLimite(25);
        }}
      >
        <Tab value="revisar" label={"Para revisar (" + revisarOps.length + ")"} panelId="operacoes-txt" />
        <Tab value="prontas" label={"Prontas (" + prontas.length + ")"} panelId="operacoes-txt" />
      </TabList>
      <div key={aba} id="operacoes-txt" className="txtpending" role="tabpanel" aria-label={aba === "revisar" ? "Para revisar" : "Prontas"}>
        {!lista.length && <p>Nenhuma operação pronta neste lote.</p>}
        {lista.slice(0, limite).map((op) => {
          const nf = valor(op, "nf");
          const nota = nf ? "NF " + nf : "Operação " + op.id;
          return (
            <div className="txtnota" key={op.id} role="group" aria-label={nota}>
              <div className="txtnota-titulo">
                <strong>{nota}</strong>
                {op.paginas.length > 0 && <small>Pág. {op.paginas.join(", ")}</small>}
              </div>
              {porOperacao.get(op.id)?.map((p) => (
                <button
                  key={p.campo}
                  aria-label={nota + " · " + rotulo(p.campo)}
                  onClick={() => revisar(p)}
                >
                  {rotulo(p.campo)} <ChevronRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          );
        })}
        {limite < lista.length && (
          <Button label="Mostrar mais operações" onClick={() => setLimite(limite + 25)} />
        )}
      </div>
    </>
  );
}
