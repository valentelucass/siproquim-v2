import { expect, test, type Locator } from "./loteDeTeste";

const relato = Array.from(
  { length: 40 },
  (_, i) => "Linha de conferência " + (i + 1),
).join("\n");

for (const tema of ["claro", "escuro"] as const) {
  test(
    "foco arredondado com mouse e teclado na correção em tema " + tema,
    async ({ page }) => {
      await page.goto("/");
      await page.getByText("Campo localizado no PDF").waitFor();
      if (tema === "escuro")
        await page.getByRole("button", { name: "Ativar tema escuro" }).click();
      await page
        .getByRole("button", { name: "Corrigir campo", exact: true })
        .click();
      const campo = page.getByRole("textbox", { name: /Fonte da correção/ });
      await campo.click();
      await expect(campo).toBeFocused();
      await expect(campo).toHaveCSS("outline-style", "none");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(campo).toBeFocused();
      const moldura = campo.locator("..");
      expect(
        await moldura.evaluate((e) =>
          parseFloat(getComputedStyle(e).borderTopLeftRadius),
        ),
      ).toBeGreaterThanOrEqual(6);
      await expect
        .poll(() => moldura.evaluate((e) => getComputedStyle(e).boxShadow))
        .not.toBe("none");
      await expect(campo).toHaveCSS("outline-style", "none");
    },
  );
}

async function conferirLimite(campo: Locator, alturaDaTela: number) {
  const alturaInicial = (await campo.boundingBox())!.height;
  await campo.fill(relato);
  // Simula a altura inline que o navegador grava quando se arrasta a alça nativa.
  await campo.evaluate((e) => (e.style.height = "1000px"));
  const caixa = await campo.evaluate((e) => ({
    altura: e.getBoundingClientRect().height,
    visivel: e.clientHeight,
    texto: e.scrollHeight,
    rolagem: getComputedStyle(e).overflowY,
    resize: getComputedStyle(e).resize,
  }));
  expect(caixa.altura).toBeGreaterThan(alturaInicial);
  expect(caixa.altura).toBeLessThanOrEqual(
    Math.min(160, alturaDaTela * 0.25) + 1,
  );
  expect(caixa.rolagem).toBe("auto");
  expect(caixa.resize).toBe("vertical");
  expect(caixa.texto).toBeGreaterThan(caixa.visivel);
  await expect(campo).toHaveValue(relato);
}

test("campos multilinha respeitam a altura da janela, na fila e no modal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  await page
    .getByRole("button", { name: "Corrigir campo", exact: true })
    .click();
  await conferirLimite(
    page.getByRole("textbox", { name: /Fonte da correção/ }),
    900,
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 560 });
  await page.getByRole("button", { name: "Novo lote", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Declarar mês sem movimento" })
    .check();
  await conferirLimite(
    page.getByRole("textbox", { name: /Evidência da conferência/ }),
    560,
  );
});
