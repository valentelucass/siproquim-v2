import { salvarTxt } from "./downloads";
import { selecionarFilial, cnpjTeste } from "./filial";
import { expect, test } from "./loteDeTeste";
import { resolve } from "node:path";

test("grade preenche a janela nas duas abas e marca a origem certa", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Campo localizado no PDF")).toBeVisible();
  for (const height of [768, 920, 1080]) {
    await page.setViewportSize({ width: 1912, height });
    for (const aba of ["PDF original", "Dados extraídos"]) {
      await page.getByRole("tab", { name: aba }).click();
      const rect = await page.locator(".desk").boundingBox();
      const foot = await page.locator("footer").boundingBox();
      expect(rect!.y + rect!.height).toBeGreaterThan(height - 75);
      expect(foot!.y + foot!.height).toBeLessThanOrEqual(height);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(1912);
    }
  }
  await expect(
    page.getByRole("table", { name: "Dados extraídos da operação" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "PDF original" }).click();
  await page.getByRole("button", { name: /CT-e ausente ou inválido/ }).click();
  await expect(page.getByLabel("PDF original, página 3")).toBeVisible();
  await expect(page.getByTestId("destaque-pdf")).toBeVisible();
  await page.getByRole("switch", { name: "Destacar campo" }).click();
  await expect(page.getByTestId("destaque-pdf")).toHaveCount(0);
});
test("header, dica, marca, temas, acessibilidade do diálogo e créditos", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Campo localizado no PDF")).toBeVisible();
  await page.getByRole("button", { name: "Histórico", exact: true }).hover();
  await expect(
    page.getByText("Ver alterações e protocolos do lote", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Histórico do lote" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Rodogarcia, página inicial" }).click();
  await expect(
    page.getByRole("heading", { name: "Conferência de fretes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("button", { name: "Novo lote" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo lote" });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (d) => getComputedStyle(d, "::backdrop").backdropFilter,
    ),
  ).toContain("blur(");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: /Lucas Andrade/ }),
  ).toHaveAttribute("href", "https://www.linkedin.com/in/dev-lucasandrade/");
  await expect(
    page.getByRole("link", { name: "lucasmac.dev@gmail.com" }),
  ).toHaveAttribute("href", "mailto:lucasmac.dev@gmail.com");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("importa PDF e registra operação sem movimento em dados isolados", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2026-10");
  await page
    .getByLabel("Relatório PDF", { exact: true })
    .setInputFiles(resolve("public/fretes-demonstracao.pdf"));
  await page.getByRole("button", { name: "Ver PDF antes de importar" }).click();
  await expect(page.getByTitle("Prévia antes da importação")).toBeVisible();
  await page.getByRole("button", { name: "Criar lote" }).click();
  await expect(
    page.locator(".summarystrip").getByText("fretes-demonstracao.pdf"),
  ).toBeVisible();
  await expect(page.getByText("Campo localizado no PDF")).toBeVisible();
  await page.getByRole("button", { name: "Novo lote" }).click();
  await selecionarFilial(page);
  await page.getByLabel("Competência", { exact: true }).fill("2026-11");
  await page
    .getByRole("checkbox", { name: "Declarar mês sem movimento" })
    .check();
  await page
    .getByRole("textbox", { name: /Evidência da conferência/ })
    .fill("Conferência de teste.");
  await page.getByRole("button", { name: "Criar lote" }).click();
  await expect(
    page.getByRole("heading", { name: "Lote sem movimento" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prévia do TXT" }).click();
  await expect(page.locator("pre")).toContainText("EM" + cnpjTeste + "NOV2026");
  const pre = await page.locator("pre").textContent();
  expect(await salvarTxt(page, "Exportar TXT")).toBe(pre);
});
test("corrige com evidência e preserva a decisão no histórico", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Campo localizado no PDF")).toBeVisible();
  await page.getByRole("button", { name: "Prévia do TXT" }).click();
  await expect(
    page.getByRole("dialog").getByText("3 campos para revisar"),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("3 de 6 operações prontas");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Exportar TXT" })).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /NF 84216/ })
    .click();
  await page.getByRole("button", { name: "Corrigir campo" }).click();
  await page
    .getByRole("textbox", { name: /Responsável pelo recebimento/ })
    .fill("RECEBEDOR FICTICIO");
  await page
    .getByRole("textbox", { name: /Fonte da correção/ })
    .fill("Teste com comprovante fictício");
  await page.getByRole("button", { name: "Salvar correção" }).click();
  await expect(page.getByText("2 pendências", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("Teste com comprovante fictício")).toBeVisible();
  await expect(page.getByText(/CARIMBO → RECEBEDOR FICTICIO/)).toBeVisible();
});
