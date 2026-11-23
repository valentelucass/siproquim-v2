import type { Resultado } from "./api";

export const exemplo: Resultado = {
  lote: {
    id: "exemplo",
    nome: "Fretes de outubro.pdf",
    cnpj: "11222333000181",
    competencia: "2026-10",
    estado: "CONFERENCIA",
    versao: 1,
    paginas: 6,
    protocolo: null,
    operacoes: [
      {
        id: 1,
        paginas: [1],
        original: { nf: "84216", recebedor: "CARIMBO" },
        ajustes: {},
      },
    ],
  },
  pendencias: [
    {
      operacao: 1,
      nf: "84216",
      campo: "recebedor",
      motivo: "Confira quem assinou o comprovante de entrega.",
    },
  ],
  decisoes: [],
};
