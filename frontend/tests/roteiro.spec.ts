import { etapas } from "../src/roteiro";
import { expect, test, type Page } from "@playwright/test";

for (const tema of ["light", "dark"] as const) {
  test(`formulários do roteiro ficam no centro e o rodapé permanece na base em ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.route("**/api/lotes", route => route.fulfill({ json: [] }));
    await page.route("**/api/atualizacoes", route => route.fulfill({ json: { disponivel: null } }));
    await page.goto("/");
    await expect(page.getByText("Importe seu primeiro lote")).toBeVisible();
    const rodape = page.locator("footer");

    async function conferirRodape() {
      await expect.poll(() =>
        rodape.evaluate(el => Math.abs(innerHeight - el.getBoundingClientRect().bottom)),
      ).toBeLessThanOrEqual(12);
    }

    async function conferirFormularioCentralizado() {
      await expect.poll(() => page.locator(".roteiro-formulario").evaluate(formulario => {
        const painel = formulario.getBoundingClientRect();
        const area = formulario.parentElement!.getBoundingClientRect();
        return Math.max(
          Math.abs((painel.left + painel.right - area.left - area.right) / 2),
          Math.abs((painel.top + painel.bottom - area.top - area.bottom) / 2),
        );
      })).toBeLessThanOrEqual(5);
    }

    await page.getByRole("button", { name: "Passo a passo", exact: true }).click();
    const guia = page.getByRole("region", { name: "Passo a passo" });
    for (let n = 1; n <= etapas.length; n++) {
      const etapa = etapas[n - 1];
      await expect(guia.getByText(`Passo ${n} de ${etapas.length}`)).toBeVisible();
      if (etapa.alvo === ".dropfile" || etapa.alvo === "[data-roteiro=criar]" ||
          etapa.alvo === "[data-roteiro=exportar]") {
        for (const [largura, altura] of [[1919, 1010], [1200, 770], [615, 1010]]) {
          await page.setViewportSize({ width: largura, height: altura });
          await conferirFormularioCentralizado();
          await conferirRodape();
          await conferirBalao(page);
        }
      }
      await guia.getByRole("button", { name: n === etapas.length ? "Concluir" : "Avançar" }).click();
    }
    await expect(guia).toHaveCount(0);
    await conferirRodape();
    await expect(rodape.getByRole("button", { name: /^Versão/ })).toBeEnabled();
  });
}

async function conferirBalao(page: Page) {
  const guia = page.getByRole("region", { name: "Passo a passo" });
  await expect(guia.locator(".roteiro-seta")).toBeVisible();
  await expect
    .poll(() =>
      guia.evaluate((balao) => {
        const marca = document
          .querySelector(".roteiro-marca")!
          .getBoundingClientRect();
        const caixa = balao.getBoundingClientRect();
        const seta = balao
          .querySelector(".roteiro-seta")!
          .getBoundingClientRect();
        const x = (seta.left + seta.right) / 2;
        const y = (seta.top + seta.bottom) / 2;
        const noAlvoX = x >= marca.left && x <= marca.right;
        const noAlvoY = y >= marca.top && y <= marca.bottom;
        const aponta =
          (caixa.top >= marca.bottom &&
            noAlvoX &&
            Math.abs(seta.top - marca.bottom) <= 5) ||
          (caixa.bottom <= marca.top &&
            noAlvoX &&
            Math.abs(seta.bottom - marca.top) <= 5) ||
          (caixa.left >= marca.right &&
            noAlvoY &&
            Math.abs(seta.left - marca.right) <= 5) ||
          (caixa.right <= marca.left &&
            noAlvoY &&
            Math.abs(seta.right - marca.left) <= 5);
        return (
          aponta &&
          caixa.left >= 0 &&
          caixa.top >= 0 &&
          caixa.right <= document.documentElement.clientWidth + 1 &&
          caixa.bottom <= innerHeight + 1
        );
      }),
    )
    .toBe(true);
}

test("produção ignora a preferência antiga de demonstração e o roteiro funciona sem lotes", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sipro.amb", "demo"));
  await page.route("**/api/lotes", (route) => route.fulfill({ json: [] }));
  const chamadas: string[] = [];
  page.on("request", (req) => {
    if (/\/(?:demo-api|api)\//.test(req.url()))
      chamadas.push(req.method() + " " + new URL(req.url()).pathname);
  });
  await page.goto("/");
  await expect(page.getByText("Importe seu primeiro lote")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /demonstração|meus dados/i }),
  ).toHaveCount(0);
  const inicio = page.locator("header button").first();
  await expect(inicio).toHaveAccessibleName("Passo a passo");
  await inicio.click();
  const guia = page.getByRole("region", { name: "Passo a passo" });
  const alvo = page.getByRole("button", { name: /Local destacado/ });
  for (let n = 1; n <= etapas.length; n++) {
    await expect(
      guia.getByText(`Passo ${n} de ${etapas.length}`),
    ).toBeVisible();
    await expect(alvo).toBeInViewport();
    await conferirBalao(page);
    if (etapas[n - 1].alvo === ".editor-inline textarea") {
      await page.setViewportSize({ width: 390, height: 360 });
      await conferirBalao(page);
      await page.evaluate(() => window.scrollBy(0, 26));
      await conferirBalao(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await conferirBalao(page);
    }
    await expect(page.locator("dialog[open], iframe")).toHaveCount(0);
    await alvo.click();
  }
  await expect(guia).toHaveCount(0);
  await expect(inicio).toBeFocused();
  await expect(page.getByText("Importe seu primeiro lote")).toBeVisible();
  expect(chamadas).toContain("GET /api/lotes");
  expect(
    chamadas.every((c) => ["GET /api/lotes", "GET /api/filiais", "GET /api/atualizacoes"].includes(c)),
  ).toBe(true);
});

test("na lateral, voltar e sair pelo teclado conservam a tela e os lotes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 615, height: 440 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Guia de conferência", exact: true })
    .click();
  const inicio = page.getByRole("button", {
    name: "Passo a passo",
    exact: true,
  });
  await inicio.focus();
  await page.keyboard.press("Enter");
  const guia = page.getByRole("region", { name: "Passo a passo" });
  const alvo = page.getByRole("button", { name: /Local destacado/ });
  const proximo = guia.getByRole("button", { name: "Avançar" });
  for (let n = 1; n <= etapas.length; n++) {
    await expect(
      guia.getByText(`Passo ${n} de ${etapas.length}`),
    ).toBeVisible();
    await expect(alvo).toBeInViewport();
    await conferirBalao(page);
    const box = await alvo.boundingBox();
    const palco = { y: 0, height: 440 };
    expect(box!.y).toBeGreaterThanOrEqual(palco!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      palco!.y + palco!.height + 1,
    );
    if (n === etapas.length) break;
    if (n === 1) await proximo.dblclick();
    else await proximo.click();
  }
  await guia.getByRole("button", { name: "Voltar" }).click();
  await expect(
    guia.getByText(`Passo ${etapas.length - 1} de ${etapas.length}`),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guia).toHaveCount(0);
  await expect(inicio).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Guia de conferência" }),
  ).toBeVisible();
});
