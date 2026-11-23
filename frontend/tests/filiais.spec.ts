import { test, expect } from "@playwright/test";
import { selecionarFilial } from "./filial";
test("lista as 19 filiais da V1 e conserva o CNPJ da seleção após criar o lote", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Novo lote" }).click();
  const campo = page.getByRole("button", { name: /^Filial declarante/ });
  await campo.click();
  const busca = page.getByPlaceholder("Buscar filial ou empresa");
  await busca.focus();
  await expect(busca).toHaveCSS("outline-style", "none");
  expect(
    await busca
      .locator("..")
      .evaluate((e) => parseFloat(getComputedStyle(e).borderRadius)),
  ).toBeGreaterThanOrEqual(6);
  await expect
    .poll(() =>
      busca.locator("..").evaluate((e) => getComputedStyle(e).boxShadow),
    )
    .not.toBe("none");
  await expect(page.getByRole("option")).toHaveCount(19);
  await page.getByRole("option", { name: /CPQ · TR Rodogarcia/i }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByLabel("CNPJ da filial selecionada")).toHaveText(
    "51.863.654/0003-41",
  );
  await page.getByLabel("Competência", { exact: true }).fill("2026-06");
  await page
    .getByRole("checkbox", { name: "Declarar mês sem movimento" })
    .check();
  await page
    .getByRole("textbox", { name: /Evidência da conferência/ })
    .fill("Seleção de filial em banco isolado.");
  const req = page.waitForRequest(
    (r) =>
      r.method() === "POST" && r.url().endsWith("/api/lotes/sem-movimento"),
  );
  await page.getByRole("button", { name: "Criar lote" }).click();
  expect((await req).postDataJSON().cnpj).toBe("51863654000341");
  await expect(page.locator(".summarystrip")).toContainText(
    "51.863.654/0003-41",
  );
  await page.reload();
  await page.getByRole("button", { name: "Novo lote" }).click();
  await expect(
    page.getByRole("button", { name: /^Filial declarante/ }),
  ).toContainText("CPQ · TR Rodogarcia");
  await selecionarFilial(page, "AGU · Dalga");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByLabel("CNPJ da filial selecionada")).toHaveText(
    "04.547.874/0003-86",
  );
});

test("erro ao carregar o cadastro oferece nova tentativa e cancelar preserva a preferência", async ({
  page,
}) => {
  await page.route(
    "**/api/filiais",
    (r) => r.fulfill({ status: 503, json: { mensagem: "Indisponível" } }),
    { times: 1 },
  );
  await page.goto("/");
  const novo = page.getByRole("button", { name: "Novo lote", exact: true });
  await novo.click();
  await expect(page.getByRole("alert")).toContainText("carregar as filiais");
  await expect(page.getByRole("button", { name: "Criar lote" })).toBeDisabled();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await selecionarFilial(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await novo.click();
  await expect(
    page.getByRole("button", { name: /^Filial declarante/ }),
  ).toContainText("Selecione a filial");
  await expect(page.getByRole("button", { name: "Criar lote" })).toBeDisabled();
});
