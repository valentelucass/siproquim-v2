import type { View } from "./Barra";

export const tipoCena = {
  inicio: { view: "conferencia", modal: "" },
  importar: { view: "conferencia", modal: "import" },
  revisar: { view: "conferencia", modal: "" },
  corrigir: { view: "conferencia", modal: "editar" },
  txt: { view: "conferencia", modal: "txt" },
  historico: { view: "historico", modal: "" },
} satisfies Record<string, { view: View; modal: string }>;
export type Cena = keyof typeof tipoCena;

export const etapas = [
  {
    cena: "inicio",
    alvo: 'header [aria-label="Novo lote"]',
    titulo: "Abra um novo lote",
    texto:
      "Clique no botão de mais destacado em vermelho ou em Avançar para ver o formulário.",
  },
  {
    cena: "importar",
    alvo: ".filialfield button[aria-haspopup]",
    titulo: "Escolha a filial",
    texto:
      "Procure a unidade pelo nome ou pela sigla. O sistema preenche o CNPJ.",
  },
  {
    cena: "importar",
    alvo: "#mes-do-frete",
    titulo: "Informe a competência",
    texto: "Selecione o mês em que os fretes foram realizados.",
  },
  {
    cena: "importar",
    alvo: ".dropfile",
    titulo: "Selecione o relatório",
    texto:
      "Escolha o PDF da filial. Você pode abrir a prévia antes de clicar em Criar lote.",
  },
  {
    cena: "importar",
    alvo: "[data-roteiro=criar]",
    titulo: "Crie o lote",
    texto:
      "Com filial, mês e PDF preenchidos, este botão importa as notas para conferência.",
  },
  {
    cena: "revisar",
    alvo: ".issuecard.current button[aria-expanded]",
    titulo: "Abra uma pendência",
    texto:
      "A fila mostra a nota e a página. Compare o valor com o PDF original.",
  },
  {
    cena: "revisar",
    alvo: "[data-roteiro=corrigir]",
    titulo: "Corrija o campo",
    texto:
      "Ao identificar o valor correto no comprovante, clique em Corrigir campo.",
  },
  {
    cena: "corrigir",
    alvo: ".editor-inline .editorfield :is(input, select)",
    titulo: "Confira o valor",
    texto:
      "Compare com o documento de origem e preencha este campo com a informação confirmada.",
  },
  {
    cena: "corrigir",
    alvo: ".editor-inline textarea",
    titulo: "Indique a fonte da correção",
    texto:
      "Informe qual comprovante consultou. Por exemplo, o canhoto de entrega da nota e a data da assinatura.",
  },
  {
    cena: "corrigir",
    alvo: "[data-roteiro=salvar]",
    titulo: "Salve a correção",
    texto:
      "Depois de preencher o valor e a fonte, este botão registra a alteração e seleciona a próxima pendência.",
  },
  {
    cena: "revisar",
    alvo: 'header [aria-label="Prévia do TXT"]',
    titulo: "Abra a prévia do TXT",
    texto:
      "O botão TXT mostra o que falta revisar ou, se o lote estiver pronto, o conteúdo do arquivo.",
  },
  {
    cena: "txt",
    alvo: "[data-roteiro=exportar]",
    titulo: "Exporte para Downloads",
    texto:
      "Quando todas as pendências forem resolvidas, Exportar TXT salva o arquivo em Downloads.",
  },
  {
    cena: "historico",
    alvo: ".timeline li",
    titulo: "Consulte o histórico",
    texto:
      "Aqui ficam as alterações do lote. Depois do envio no portal da PF, registre o recibo para consultar o protocolo.",
  },
] satisfies { cena: Cena; alvo: string; titulo: string; texto: string }[];
