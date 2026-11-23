import { salvarTxt } from "./downloads";
import { selecionarFilial } from "./filial";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("frete real na API de teste vai da conferência ao protocolo e à retificação", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2026-10");
  const pdf = await readFile("public/fretes-demonstracao.pdf");
  await page.getByLabel("Relatório PDF").setInputFiles({
    name: "Teste de fechamento.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([pdf, Buffer.from("\n% fluxo completo\n")]),
  });
  await page.getByRole("button", { name: "Criar lote" }).click();
  await page.getByText("Campo localizado no PDF").waitFor();
  const campos = [
    ["Responsável pelo recebimento", "PESSOA FICTICIA"],
    ["Número do CT-e", "39017"],
    ["Emissão do CT-e", "08/10/2026"],
    ["CPF/CNPJ · destino", "11222333000181"],
  ];
  for (const [campo, valor] of campos) {
    await page
      .getByRole("button", { name: "Corrigir campo", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: new RegExp(campo.replace("/", "\\/")) })
      .fill(valor);
    await page
      .getByRole("textbox", { name: /Fonte da correção/ })
      .fill("Comprovante simulado de teste.");
    await page.getByRole("button", { name: "Salvar correção" }).click();
    await expect(
      page.getByRole("button", { name: "Salvar correção" }),
    ).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Prévia do TXT" }).click();
  const pre = page.locator("pre");
  await expect(pre).toContainText("PESSOA FICTICIA");
  const bytes = await pre.textContent();
  expect(await salvarTxt(page, "Exportar TXT")).toBe(bytes);
  await page
    .getByRole("button", { name: "Registrar processamento", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByRole("textbox", { name: /^Evidência/ }).fill("Retorno simulado.");
  await d
    .getByRole("button", { name: "Registrar processamento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar recibo", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Protocolo", { exact: true }).fill("TESTE-LOCAL");
  await d.getByLabel("Data do protocolo").fill("2026-11-11");
  await d.getByRole("textbox", { name: /^Evidência/ }).fill("Recibo simulado de teste.");
  await d
    .getByRole("button", { name: "Registrar recibo", exact: true })
    .click();
  await page.getByRole("button", { name: "Reabrir lote" }).click();
  d = page.getByRole("dialog");
  await d.getByRole("textbox", { name: /^Evidência/ }).fill("Retificação de teste.");
  await d.getByRole("button", { name: "Reabrir para retificação" }).click();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Protocolo TESTE-LOCAL · 11/11/2026"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Consultar anexo" }),
  ).toHaveCount(0);
  expect(await salvarTxt(page, "TXT desta versão")).toBe(bytes);
});

test("recibo anexado exige a mesma filial e competência e permite recuperar o PDF", async ({
  page,
  request,
}) => {
  const headers = { "X-Siproquim-UI": "local" };
  const competencia = "2025-08",
    cnpj = "11222333000181";
  const criado = await request.post("/api/lotes/sem-movimento", {
    headers,
    data: { cnpj, competencia, evidencia: "Ensaio de anexo" },
  });
  expect(criado.ok()).toBeTruthy();
  const { lote } = await criado.json();
  for (const [etapa, versao] of [
    ["exportar", 1],
    ["processamento", 2],
  ] as const) {
    const res = await request.post("/api/lotes/" + lote.id + "/" + etapa, {
      headers,
      data: { versao, evidencia: "Teste local" },
    });
    expect(res.ok()).toBeTruthy();
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Meus lotes" }).click();
  await page.getByRole("textbox", { name: "Buscar lote" }).fill(competencia);
  await page
    .getByRole("table", { name: "Lotes importados" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Registrar recibo" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Protocolo", { exact: true }).fill("TESTE-COM-ANEXO");
  await d.getByLabel("Data do protocolo").fill("2025-09-01");
  await d.getByRole("textbox", { name: /^Evidência/ }).fill("Recibo fictício.");
  const pdf = await readFile("public/fretes-demonstracao.pdf");
  await d.getByLabel(/PDF do recibo/).setInputFiles({
    name: "recibo-ficticio.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await d.getByLabel("CNPJ no recibo").fill(cnpj);
  await d.getByLabel("Competência no recibo").fill("2025-07");
  const registrar = d.getByRole("button", {
    name: "Registrar recibo",
    exact: true,
  });
  await registrar.click();
  await expect(d.getByRole("alert")).toContainText(/filial e competência/);
  await d.getByLabel("Competência no recibo").fill(competencia);
  await registrar.click();
  await expect(d).toHaveCount(0);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  const espera = page.waitForEvent("download");
  await page.getByRole("button", { name: "Consultar anexo" }).click();
  expect(await readFile((await (await espera).path())!)).toEqual(pdf);
});
