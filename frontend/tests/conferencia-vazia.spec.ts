import { expect, test } from "@playwright/test";
import { test as comLote } from "./loteDeTeste";

for (const tema of ["light", "dark"] as const) {
  test(`a conferência sem lotes oferece importação em um cartão centralizado em ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.route("**/api/lotes", route => route.fulfill({ json: [] }));
    await page.route("**/api/atualizacoes", route => route.fulfill({ json: { disponivel: null } }));
    await page.goto("/");
    await expect(page.getByText("Importe seu primeiro lote")).toBeVisible();
    await page.getByRole("button", { name: "Conferência", exact: true }).click();

    const painel = page.getByRole("main").locator(".panel");
    for (const [width, height] of [[1919, 1010], [390, 660]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => painel.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(480);
      await expect.poll(() => painel.evaluate(el => {
        const cartao = el.getBoundingClientRect();
        const area = el.parentElement!.getBoundingClientRect();
        return Math.max(
          Math.abs((cartao.left + cartao.right - area.left - area.right) / 2),
          Math.abs((cartao.top + cartao.bottom - area.top - area.bottom) / 2),
        );
      })).toBeLessThanOrEqual(5);
      await expect(page.locator("footer")).toBeInViewport();
    }

    const importar = painel.getByRole("button", { name: "Importar relatório" });
    await expect(importar).toHaveAttribute("data-variant", "primary");
    await importar.focus();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog", { name: "Novo lote" });
    await expect(dialogo).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    await expect(importar).toBeFocused();
    await painel.getByRole("button", { name: "Ver passo a passo" }).click();
    const guia = page.getByRole("region", { name: "Passo a passo" });
    await expect(guia).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel.getByRole("button", { name: "Ver passo a passo" })).toBeFocused();
  });
}

comLote("quando há lotes disponíveis, a conferência permite abrir o arquivo", async ({ page }) => {
  await page.route(/\/api\/lotes\/[^/?]+$/, route => route.fulfill({ status: 503 }), { times: 1 });
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Abrir meus lotes", exact: true }).click();
  const tabela = page.getByRole("table", { name: "Lotes importados" });
  await expect(tabela).toBeVisible();
  await tabela.getByRole("button", { name: /Fretes de teste/ }).first().click();
  await expect(page.getByText("Campo localizado no PDF")).toBeVisible();
});
