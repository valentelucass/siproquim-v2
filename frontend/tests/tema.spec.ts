import { test, expect } from "./loteDeTeste";
test("pressionar ocorrência mantém os cantos arredondados e foco de teclado visível", async ({
  page,
}) => {
  await page.goto("/");
  const btn = page.getByRole("button", { name: /CT-e ausente ou inválido/ });
  await btn.hover();
  await page.mouse.down();
  try {
    expect(
      await btn.evaluate((e) =>
        parseFloat(getComputedStyle(e).borderTopLeftRadius),
      ),
    ).toBeGreaterThanOrEqual(6);
  } finally {
    await page.mouse.up();
  }
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(btn).toBeFocused();
});
test("folha acompanha o tema escuro e permite examinar as cores originais", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  const canvas = page.locator(".sheet canvas");
  expect(await canvas.evaluate((e) => getComputedStyle(e).filter)).toContain(
    "invert",
  );
  await page.getByRole("switch", { name: "Cores originais" }).click();
  expect(await canvas.evaluate((e) => getComputedStyle(e).filter)).toBe("none");
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  expect(await canvas.evaluate((e) => getComputedStyle(e).filter)).toBe("none");
});
