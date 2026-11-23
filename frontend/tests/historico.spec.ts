import { test, expect } from "@playwright/test";
test("um arquivo vazio abre o histórico sem eventos de exemplo", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sipro.amb", "demo"));
  await page.route("**/api/lotes", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.getByText("Importe seu primeiro lote").waitFor();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("Nenhum lote selecionado")).toBeVisible();
  await expect(page.getByText("PDF importado", { exact: true })).toHaveCount(0);
});
