import type { Page } from "@playwright/test";
export const cnpjTeste = "60960473000758";
export async function selecionarFilial(page: Page, nome = "CPQ · Rodogarcia") {
  await page.getByRole("button", { name: /^Filial declarante/ }).click();
  await page.getByRole("option", { name: new RegExp(nome, "i") }).click();
}
