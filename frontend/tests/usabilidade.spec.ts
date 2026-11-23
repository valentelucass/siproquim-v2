import { expect, test } from "./loteDeTeste";
import { readFile } from "node:fs/promises";
import { selecionarFilial } from "./filial";
import type { Resultado } from "../src/api";

test("na lateral a pessoa abre a página da pendência e retorna à revisão", async ({
  page,
}) => {
  await page.setViewportSize({ width: 615, height: 440 });
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  const ocorrencia = page.getByRole("button", { name: /CT-e ausente ou inválido/ });
  if ((await ocorrencia.getAttribute("aria-expanded")) !== "true") {
    await ocorrencia.click();
  }
  await page.getByRole("link", { name: "Ver página no PDF" }).click();
  await expect(
    page.getByRole("heading", { name: "Prévia do relatório" }),
  ).toBeInViewport();
  await expect(page.getByLabel("PDF original, página 3")).toBeVisible();
  await page.getByRole("link", { name: "Voltar à revisão" }).click();
  await expect(
    page.getByRole("heading", { name: "Fila de revisão" }),
  ).toBeInViewport();
  await expect(page.locator(".issuecard.current")).toContainText("84218");
});

for (const tema of ["light", "dark"] as const) {
  test("ajuda do mês com mouse e teclado no tema " + tema, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.setViewportSize({ width: 660, height: 730 });
    await page.goto("/");
    await page.getByText("Campo localizado no PDF").waitFor();
    await page.getByRole("button", { name: "Novo lote" }).click();
    const modal = page.getByRole("dialog");
    const ajuda = modal.getByRole("button", { name: /sobre competência/i });
    await ajuda.hover();
    const dica = page
      .getByRole("tooltip")
      .filter({ hasText: /mês em que o frete foi realizado/i });
    await expect(dica).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(dica).toBeHidden();
    await modal.getByLabel("Competência", { exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(ajuda).toBeFocused();
    await expect(dica).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dica).toBeHidden();
    await expect(modal).toBeVisible();
  });
}

test("as ações do formulário ficam alcançáveis na altura do painel lateral", async ({
  page,
}) => {
  await page.setViewportSize({ width: 615, height: 440 });
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  const modal = page.getByRole("dialog");
  const cancelar = modal.getByRole("button", { name: "Cancelar" });
  await expect(cancelar).toBeVisible();
  await expect
    .poll(() =>
      cancelar.evaluate((e) => {
        const rect = e.getBoundingClientRect();
        return e.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        );
      }),
    )
    .toBe(true);
  await cancelar.click();
  await expect(modal).toHaveCount(0);
});

test("a referência longa pode ser corrigida antes do envio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Competência", { exact: true }).fill("2026-10");
  await modal
    .getByRole("checkbox", { name: /Declarar mês sem movimento/ })
    .check();
  const referencia = modal.getByRole("textbox", { name: /Evidência/ });
  await referencia.fill("a".repeat(1001));
  await expect(
    modal
      .locator("form")
      .getByText("Resuma a referência em até 1.000 caracteres."),
  ).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Criar lote" }),
  ).toBeDisabled();
  await referencia.fill("Relatório mensal de teste.");
  await expect(modal.getByRole("button", { name: "Criar lote" })).toBeEnabled();
});

test("importação explica um arquivo incorreto e permite substituí-lo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  const modal = page.getByRole("dialog");
  await selecionarFilial(page);
  await modal.getByLabel("Competência", { exact: true }).fill("2026-10");
  const anexo = modal.getByLabel("Relatório PDF");
  await anexo.setInputFiles({
    name: "relatorio.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("Um arquivo de texto."),
  });
  await expect(modal.getByRole("alert")).toContainText("Escolha um PDF");
  await expect(
    modal.getByRole("button", { name: "Criar lote" }),
  ).toBeDisabled();
  await expect(
    modal.getByRole("button", { name: "Ver PDF antes de importar" }),
  ).toHaveCount(0);
  await anexo.setInputFiles("public/fretes-demonstracao.pdf");
  await expect(modal.getByRole("alert")).toHaveCount(0);
  await modal
    .getByRole("button", { name: "Ver PDF antes de importar" })
    .click();
  await expect(modal.frameLocator("iframe").owner()).toBeVisible();
  await expect(modal.getByRole("button", { name: "Criar lote" })).toBeEnabled();
});

test("cada campo da operação abre, orienta, salva no lote de teste e preserva o original", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2026-10");
  const pdf = await readFile("public/fretes-demonstracao.pdf");
  await page.getByLabel("Relatório PDF").setInputFiles({
    name: "Conferência de campos.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([pdf, Buffer.from("\n% ensaio dos campos\n")]),
  });
  const criado = page.waitForResponse(
    (r) => r.url().endsWith("/api/lotes") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Criar lote" }).click();
  const inicial: Resultado = await (await criado).json();
  const operacao = inicial.lote.operacoes[0];
  const todas = page.getByRole("tab", { name: /Todas as operações/ });
  async function escolherCampo() {
    await todas.click();
    const primeira = page.locator(".issuecard").first();
    const trigger = primeira.locator("button[aria-expanded]").first();
    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
    await primeira.getByRole("button", { name: "Ver todos os campos" }).click();
  }
  await escolherCampo();
  const escolher = page.getByLabel("Escolher campo");
  const campos = await escolher.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({
      id: (o as HTMLOptionElement).value,
      nome: o.textContent!,
    })),
  );
  expect(campos).toHaveLength(44);
  const ajustes: Record<string, string> = {};
  for (const [indice, { id, nome }] of campos.entries()) {
    await test.step(nome, async () => {
      if (indice) await escolherCampo();
      await escolher.selectOption(id);
      await page.getByRole("button", { name: "Editar este campo" }).click();
      const form = page
        .locator("form")
        .filter({ has: page.getByRole("button", { name: "Salvar correção" }) });
      const controle = form.getByLabel(nome, { exact: true });
      await expect(controle).toHaveAccessibleDescription(/.{12,}/);
      const antigo = await controle.inputValue();
      if (await controle.evaluate((e) => e.tagName === "SELECT")) {
        const valor = await controle
          .locator("option")
          .evaluateAll(
            (opts, atual) =>
              opts
                .map((o) => (o as HTMLOptionElement).value)
                .find((v) => v && v !== atual),
            antigo,
          );
        expect(valor).toBeTruthy();
        await controle.selectOption(valor!);
      } else {
        const exemplo = id.startsWith("data")
          ? "30/10/2026"
          : id.endsWith("Cidade")
            ? "BAURU - SP"
            : id.endsWith("Doc")
              ? "12345678909"
              : id === "modal"
                ? "ROFE"
                : [
                      "nf",
                      "cte",
                      "conhecimentoDe",
                      "duplicataDe",
                      "pais",
                    ].includes(id)
                  ? "007"
                  : "Exemplo de teste";
        await controle.fill(exemplo);
      }
      ajustes[id] = await controle.inputValue();
      const salvar = form.getByRole("button", { name: "Salvar correção" });
      await expect(salvar).toBeDisabled();
      await form
        .getByRole("textbox", { name: /Fonte da correção/ })
        .fill("Documento fictício da validação.");
      const gravado = page.waitForResponse(
        (r) =>
          r.url().endsWith("/operacoes") && r.request().method() === "PATCH",
      );
      await salvar.click();
      const resposta = await gravado;
      expect(resposta.ok()).toBe(true);
      const atualizado: Resultado = await resposta.json();
      const op = atualizado.lote.operacoes.find((o) => o.id === operacao.id)!;
      expect(op.original).toEqual(operacao.original);
      expect(op.ajustes).toMatchObject(ajustes);
      await expect(salvar).toHaveCount(0);
    });
  }
  const consulta = await page.request.get("/api/lotes/" + inicial.lote.id, {
    headers: { "X-Siproquim-UI": "local" },
  });
  expect((await consulta.json()).lote.operacoes[0].ajustes).toMatchObject(
    ajustes,
  );
});
