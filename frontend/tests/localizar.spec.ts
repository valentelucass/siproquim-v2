import { test, expect } from "@playwright/test";
import { localizar } from "../src/localizar";

const op = {
  id: 1,
  paginas: [1],
  original: {
    nf: "66",
    recebedor: "CARIMBO",
    cte: "48390",
    destinoDoc: "11222333000181",
    dataEntrega: "15/02/2026",
  },
  ajustes: {},
};
const trecho = [
  "DATA NF",
  "12/02/2026",
  "NF",
  "66",
  "DESTINATÁRIO",
  "FICTÍCIO",
  "CNPJ/CPF",
  ": 11.222.333/0001-81",
  "Nº CT-e",
  ": 48390",
  "RECEBEDOR",
  ": CARIMBO",
  "DATA ENTREGA",
  ": 15/02/2026 10:00",
];
const itens = (s: string[]) => s.map((str) => ({ str }));
test("o destaque encontra o valor quando os dois-pontos estão separados do rótulo", () => {
  const p = itens(trecho);
  for (const [k, i] of [
    ["recebedor", 11],
    ["cte", 9],
    ["destinoDoc", 7],
    ["dataEntrega", 13],
  ] as const)
    expect(localizar(p, op, k)).toBe(p[i]);
});
test("notas iguais com CT-es distintos destacam o valor da prestação correta", () => {
  const outro = trecho.map((s) => (s === ": 48390" ? ": 98765" : s));
  const p = itens([...outro, ...trecho]);
  expect(localizar(p, op, "recebedor")).toBe(p[outro.length + 11]);
  expect(localizar(itens([...trecho, ...trecho]), op, "recebedor")).toBeNull();
});
test("o rótulo sozinho não é evidência da localização de um valor divergente", () => {
  const p = itens(
    trecho.map((s) =>
      s === ": 11.222.333/0001-81" ? ": 55.555.555/0001-55" : s,
    ),
  );
  expect(localizar(p, op, "destinoDoc")).toBeNull();
});
