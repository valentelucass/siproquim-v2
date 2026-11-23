import type { ReactNode } from "react";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Button } from "@astryxdesign/core/Button";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Eye,
  ListStart,
  FolderOpen,
  History,
  Moon,
  Plus,
  Sun,
} from "lucide-react";
export type View = "conferencia" | "lotes" | "historico" | "guia";
export const titulos: Record<View, string> = {
  conferencia: "Conferência de fretes",
  lotes: "Meus lotes",
  historico: "Histórico do lote",
  guia: "Guia de conferência",
};
export function AcaoIcone({
  nome,
  dica,
  icone,
  onClick,
  ativo,
  disabled,
}: {
  nome: string;
  dica: string;
  icone: ReactNode;
  onClick: () => void;
  ativo?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={dica} placement="below" delay={180} focusTrigger="always">
      <Button
        label={nome}
        isIconOnly
        icon={icone}
        variant="ghost"
        isDisabled={disabled}
        aria-pressed={ativo}
        className={"headericon" + (ativo ? " active" : "")}
        onClick={onClick}
      />
    </Tooltip>
  );
}
export function Barra({
  emRoteiro,
  view,
  go,
  tema,
  toggle,
  roteiro,
  criar,
  previa,
  suporte,
  lote,
}: {
  emRoteiro: boolean;
  view: View;
  go: (v: View) => void;
  tema: string;
  toggle: () => void;
  roteiro: () => void;
  criar: () => void;
  previa: () => void;
  suporte: () => void;
  lote: boolean;
}) {
  return (
    <header className="topbar" inert={emRoteiro}>
      <div className="headbrand">
        <Tooltip
          content="Ir para a página inicial"
          placement="below"
          focusTrigger="always"
        >
          <a
            className="brandhome"
            href="#inicio"
            aria-label="Rodogarcia, página inicial"
            onClick={(e) => {
              e.preventDefault();
              go("conferencia");
            }}
          >
            <span className="marca">
              <img src="/marca.png" alt="Rodogarcia" />
            </span>
          </a>
        </Tooltip>
        <span className="vline" />
        <h1>{titulos[view]}</h1>
      </div>
      <div className="headtools">
        <nav aria-label="Navegação principal">
          <Tooltip
            content="Ver onde clicar, da importação até o TXT"
            placement="below"
            focusTrigger="always"
          >
            <Button
              label="Passo a passo"
              icon={<ListStart size={17} />}
              size="sm"
              variant="secondary"
              onClick={roteiro}
            />
          </Tooltip>
          <AcaoIcone
            nome="Conferência"
            dica="Conferir as pendências no PDF"
            icone={<ClipboardCheck size={17} />}
            ativo={view === "conferencia"}
            onClick={() => go("conferencia")}
          />
          <AcaoIcone
            nome="Meus lotes"
            dica="Consultar os relatórios que você já importou"
            icone={<FolderOpen size={17} />}
            ativo={view === "lotes"}
            onClick={() => go("lotes")}
          />
          <AcaoIcone
            nome="Histórico"
            dica="Ver alterações e protocolos do lote"
            icone={<History size={17} />}
            ativo={view === "historico"}
            onClick={() => go("historico")}
          />
          <AcaoIcone
            nome="Guia de conferência"
            dica="Consultar as etapas e o manual da PF"
            icone={<BookOpen size={17} />}
            ativo={view === "guia"}
            onClick={() => go("guia")}
          />
        </nav>
        <i className="vline" />
        <ButtonGroup
          label="Ações do lote e aparência"
          size="sm"
          className="toolgroup"
        >
          <AcaoIcone
            nome="Novo lote"
            dica="Escolher a filial, o mês e o PDF dos fretes"
            icone={<Plus size={18} />}
            onClick={criar}
          />
          <Tooltip
            content={
              lote
                ? "Ver as pendências ou salvar o TXT em Downloads"
                : "Abra um lote para conferir o TXT"
            }
            placement="below"
            focusTrigger="always"
          >
            <Button
              label="TXT"
              aria-label="Prévia do TXT"
              icon={<Eye size={16} />}
              size="sm"
              variant="secondary"
              isDisabled={!lote}
              onClick={previa}
            />
          </Tooltip>
          <AcaoIcone
            nome="Copiar informações para o desenvolvedor"
            dica="Deu erro? Clique para copiar os detalhes e cole na conversa com o suporte."
            icone={<ClipboardList size={17} />}
            onClick={suporte}
          />
          <AcaoIcone
            nome={tema === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
            dica={
              tema === "light"
                ? "Mudar para o tema escuro"
                : "Mudar para o tema claro"
            }
            icone={tema === "light" ? <Moon size={16} /> : <Sun size={17} />}
            onClick={toggle}
          />
        </ButtonGroup>
      </div>
    </header>
  );
}
