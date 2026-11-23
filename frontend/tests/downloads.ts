import { expect, type Page } from "@playwright/test";
import { basename, dirname } from "node:path";
import { readFile } from "node:fs/promises";

export async function salvarTxt(page: Page, botao: string) {
  const gravacao = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/salvar-txt"),
  );
  await page.getByRole("button", { name: botao, exact: true }).click();
  const res = await gravacao;
  expect(res.ok()).toBeTruthy();
  const { nome, caminho } = await res.json();
  expect(basename(caminho)).toBe(nome);
  expect(basename(dirname(caminho))).toBe("Downloads");
  expect(basename(dirname(dirname(caminho)))).toMatch(/^siproquim-ui-test-/);
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo em Downloads: " + nome }),
  ).toBeVisible();
  return readFile(caminho, "utf8");
}
