import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  FileText,
  FolderOpen,
  History,
  Landmark,
} from "lucide-react";

const duvidas = [
  [
    "O relatório mostra “CARIMBO”. Quem devo informar?",
    "Abra o comprovante de entrega e identifique quem assinou. Registre essa fonte na correção. Se o nome continuar desconhecido, deixe a ocorrência pendente.",
  ],
  [
    "A nota aparece duas vezes. Qual ocorrência revisar?",
    "Compare emitente, data, contratante, CT-e e páginas. O número da NF sozinho pode se repetir entre prestações diferentes.",
  ],
  [
    "Posso exportar um frete sem CT-e?",
    "Confira os municípios efetivos de retirada e entrega. Se a prestação foi intermunicipal ou interestadual, o conhecimento é obrigatório. Para a prestação municipal, confirme o trajeto com evidência.",
  ],
  [
    "O TXT foi processado. Onde encontro a confirmação de entrega?",
    "Confira o envio no módulo Mapas da PF. Registre o número e a data que aparecem no recibo. O histórico mantém a versão do TXT associada ao protocolo.",
  ],
];
const fontes = [
  [
    "Manual técnico do TXT",
    "Posições, registros e dependências do arquivo.",
    "https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/manual-tecnico",
  ],
  [
    "Roteiros do módulo Mapas",
    "Importação, envio, recibo e retificação.",
    "https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/roteiros-e-apresentacoes/roteiros-mapas",
  ],
];
export function Guia({
  criar,
  conferir,
  previa,
  historico,
  temLote,
}: {
  criar: () => void;
  conferir: () => void;
  previa: () => void;
  historico: () => void;
  temLote: boolean;
}) {
  const etapas = [
    {
      icon: FolderOpen,
      titulo: "Reunir os fretes",
      texto:
        "Escolha o relatório da filial e a competência. Você pode abrir o PDF antes da importação.",
      acao: "Novo lote",
      fn: criar,
    },
    {
      icon: FileSearch,
      titulo: "Conferir as pendências",
      texto:
        "Selecione uma ocorrência, compare o campo com a página indicada e registre a fonte da correção.",
      acao: "Abrir conferência",
      fn: conferir,
    },
    {
      icon: FileCheck2,
      titulo: "Revisar o arquivo final",
      texto:
        "Depois de resolver as pendências, confira o TXT e exporte o arquivo que será importado no portal.",
      acao: "Prévia do TXT",
      fn: previa,
    },
    {
      icon: History,
      titulo: "Guardar o protocolo",
      texto:
        "Após o envio no portal, guarde o recibo com número e data. Consulte os registros e as retificações no histórico.",
      acao: "Abrir histórico",
      fn: historico,
    },
  ];
  return (
    <div className="helpgrid">
      <Card padding={5} className="helpflow">
        <div className="helptitle">
          <ClipboardCheck />
          <div>
            <h2>Fechamento mensal</h2>
            <p>Do relatório da filial ao recibo da Polícia Federal.</p>
          </div>
        </div>
        <ol>
          {etapas.map(({ icon: I, titulo, texto, acao, fn }, i) => (
            <li key={titulo}>
              <span className="stepicon">
                <I size={19} />
              </span>
              <section>
                <small>Etapa {i + 1} de 4</small>
                <h3>{titulo}</h3>
                <p>{texto}</p>
                <Button
                  label={acao}
                  variant="secondary"
                  size="sm"
                  onClick={fn}
                  isDisabled={i > 0 && !temLote}
                />
              </section>
            </li>
          ))}
        </ol>
      </Card>
      <div className="helpside">
        <Card padding={5}>
          <div className="helptitle">
            <BookOpen />
            <h2>Dúvidas da conferência</h2>
          </div>
          {duvidas.map(([q, a], i) => (
            <div key={q} className="faq">
              <Collapsible trigger={q} defaultIsOpen={i === 0}>
                <p>{a}</p>
              </Collapsible>
            </div>
          ))}
        </Card>
        <Card padding={5}>
          <div className="helptitle">
            <Landmark />
            <h2>Fontes oficiais</h2>
            <Badge variant="neutral" label="PF" />
          </div>
          {fontes.map(([t, d, url]) => (
            <a
              key={url}
              className="source"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={17} />
              <span>
                <b>{t}</b>
                <small>{d}</small>
              </span>
              <ArrowUpRight size={15} />
            </a>
          ))}
        </Card>
      </div>
    </div>
  );
}
