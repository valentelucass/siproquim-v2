import { test as base, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Cada cenário parte de uma importação própria no backend temporário.
export const test = base.extend({
  page: async ({ page, request }, use, info) => {
    const id = randomUUID();
    const pdf = await readFile("public/fretes-demonstracao.pdf");
    const nome = info.title.startsWith("guia, arquivo")
      ? "Fretes de outubro.pdf"
      : `Fretes de teste ${id}.pdf`;
    const res = await request.post("/api/lotes", {
      headers: { "X-Siproquim-UI": "local" },
      multipart: {
        cnpj: "11222333000181",
        competencia: "2026-10",
        arquivo: {
          name: nome,
          mimeType: "application/pdf",
          buffer: Buffer.concat([pdf, Buffer.from("\n% " + id + "\n")]),
        },
      },
    });
    expect(res.ok()).toBe(true);
    await use(page);
  },
});
export { expect };
export type { Locator } from "@playwright/test";
