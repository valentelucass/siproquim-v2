import { salvarTxt } from "./downloads";
import { selecionarFilial, cnpjTeste } from "./filial";
import { readFile } from "node:fs/promises";
import { expect, test } from "./loteDeTeste";

test("guia, arquivo e histórico navegam nos dois temas", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  const nav = page.getByRole("navigation");
  for (const tema of ["claro", "escuro"]) {
    if (tema === "escuro")
      await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    await nav.getByRole("button", { name: "Guia de conferência" }).click();
    await page.getByRole("button", { name: /Posso exportar/ }).click();
    await expect(
      page.getByText(/Confira os municípios efetivos/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Manual técnico/ }),
    ).toHaveAttribute("href", /^https:\/\/www.gov.br\/pf\//);
    await page.getByRole("button", { name: "Abrir histórico" }).click();
    await expect(
      page.getByRole("heading", { name: "Atividade do lote" }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "Meus lotes" }).click();
    await page
      .getByRole("textbox", { name: "Buscar lote" })
      .fill("inexistente");
    await expect(
      page.getByText("Nenhum lote corresponde aos filtros"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page
      .getByLabel("Situação", { exact: true })
      .selectOption("PROTOCOLADO");
    await expect(
      page.getByRole("button", { name: "Fretes de outubro.pdf" }),
    ).toHaveCount(0);
    await page.getByLabel("Situação", { exact: true }).selectOption("");
    await page.getByRole("button", { name: "Fretes de outubro.pdf" }).click();
    await expect(
      page.getByRole("heading", { name: "Prévia do relatório" }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("falha ao baixar o TXT permite tentar de novo sem anunciar sucesso", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote", exact: true }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2025-06");
  await page
    .getByRole("checkbox", { name: "Declarar mês sem movimento" })
    .check();
  await page
    .getByRole("textbox", { name: /Evidência da conferência/ })
    .fill("Ensaio do download.");
  await page.getByRole("button", { name: "Criar lote" }).click();
  await page.getByRole("heading", { name: "Lote sem movimento" }).waitFor();
  await page.getByRole("button", { name: "Prévia do TXT" }).click();
  await page.route(
    "**/api/lotes/*/salvar-txt",
    (route) =>
      route.fulfill({
        status: 503,
        json: { mensagem: "Download indisponível no teste." },
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Exportar TXT" }).click();
  await expect(page.getByText("Download indisponível no teste.")).toBeVisible();
  expect(await page.getByText(/^Salvo em Downloads:/).count()).toBe(0);
  expect(await salvarTxt(page, "Baixar TXT")).toContain("EM" + cnpjTeste);
});

test("uma fila grande mantém as demais ocorrências acessíveis por busca e página", async ({
  page,
}) => {
  await page.route(/\/api\/lotes\/[^/]+$/, async (route) => {
    const res = await route.fetch(),
      json = await res.json();
    const base = json.lote.operacoes[0],
      p = json.pendencias[0];
    json.lote.operacoes = Array.from({ length: 180 }, (_, i) => ({
      ...base,
      id: i + 1,
      original: { ...base.original, nf: String(90000 + i) },
    }));
    json.pendencias = json.lote.operacoes.map((o: typeof base) => ({
      ...p,
      operacao: o.id,
      nf: o.original.nf,
    }));
    await route.fulfill({ response: res, json });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Pendências (180)" }).waitFor();
  const fila = page.getByRole("tabpanel", { name: "Ocorrências" });
  expect(await fila.locator(".issuecard").count()).toBeLessThanOrEqual(50);
  await page
    .getByRole("button", { name: "Próxima página de ocorrências" })
    .click();
  await expect(fila.getByText("NF 90000", { exact: false })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Buscar nota ou campo" })
    .fill("90179");
  await expect(fila.locator(".issuecard")).toHaveCount(1);
  await fila.getByRole("button", { name: /90179/ }).click();
  await expect(
    page.getByText("Nota fiscal 90179 · Operação 180"),
  ).toBeVisible();
});

test("reimportar um PDF antigo mantém a conferência no lote escolhido", async ({
  page,
  request,
}) => {
  const headers = { "X-Siproquim-UI": "local" };
  const arquivo = {
    name: "Relatório escolhido.pdf",
    mimeType: "application/pdf",
    buffer: await readFile("public/fretes-demonstracao.pdf"),
  };
  const base = { cnpj: cnpjTeste, competencia: "2024-10" };
  const primeiro = await request.post("/api/lotes", {
    headers,
    multipart: { ...base, arquivo },
  });
  expect(primeiro.ok()).toBeTruthy();
  const anterior = (await primeiro.json()).lote.id;
  const novo = await request.post("/api/lotes/sem-movimento", {
    headers,
    data: { ...base, competencia: "2024-11", evidencia: "Outro mês de teste." },
  });
  expect(novo.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.locator(".summarystrip")).toBeVisible();
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill(base.competencia);
  await page.getByLabel("Relatório PDF").setInputFiles(arquivo);
  const salvo = page.waitForResponse(
    (r) => r.url().endsWith("/api/lotes") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Criar lote" }).click();
  expect((await (await salvo).json()).lote.id).toBe(anterior);
  await expect(
    page.getByLabel("PDF original, página 1", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".summarystrip")).toContainText(arquivo.name);
});

test("a busca encontra a pendência pelo nome do campo e pela palavra usada no PDF", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2026-10");
  const pdf = await readFile("public/fretes-demonstracao.pdf");
  await page.getByLabel("Relatório PDF").setInputFiles({
    name: "Busca por campo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([
      pdf,
      Buffer.from("\n% ensaio da busca por campo\n"),
    ]),
  });
  await page.getByRole("button", { name: "Criar lote" }).click();
  await expect(page.locator(".summarystrip")).toContainText(
    "Busca por campo.pdf",
  );
  const busca = page.getByRole("textbox", { name: "Buscar nota ou campo" });
  const ocorrencias = page.locator(".issuecard");
  for (const [termo, nota] of [
    ["  CPF/CNPJ  ", "84220"],
    ["destinatario", "84220"],
    ["recebimento", "84216"],
    ["numero do ct-e", "84218"],
    ["NF 84216", "84216"],
  ]) {
    await busca.fill(termo);
    await expect(ocorrencias).toHaveCount(1);
    await expect(ocorrencias).toContainText(nota);
  }
});
