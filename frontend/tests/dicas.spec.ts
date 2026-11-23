import { test, expect } from "./loteDeTeste";

test("o roteiro preserva a busca e a correção em digitação", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Campo localizado no PDF").waitFor();
  const busca = page.getByRole("textbox", { name: "Buscar nota ou campo" });
  await busca.fill("recebimento");
  await page.getByRole("button", { name: "Corrigir campo" }).click();
  const valor = page.getByLabel("Responsável pelo recebimento", {
    exact: true,
  });
  const fonte = page.getByRole("textbox", { name: /Fonte da correção/ });
  await valor.fill("Rascunho fictício");
  await fonte.fill("Em conferência no teste");
  await page
    .getByRole("button", { name: "Passo a passo", exact: true })
    .click();
  const guia = page.getByRole("region", { name: "Passo a passo" });
  await guia.getByRole("button", { name: "Avançar" }).click();
  await expect(page.locator("dialog[open], iframe")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(valor).toHaveValue("Rascunho fictício");
  await expect(fonte).toHaveValue("Em conferência no teste");
  await expect(busca).toHaveValue("recebimento");
});

for (const tema of ["light", "dark"] as const) {
  test(
    "as ações da conferência explicam sua função com mouse e teclado em " +
      tema,
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await page.goto("/");
      await page.getByText("Campo localizado no PDF").waitFor();
      for (const [papel, nome, texto] of [
        ["button", "Corrigir campo", "comprovante"],
        ["button", "Ver todos os campos", "outros dados"],
        ["tab", "PDF original", "relatório enviado"],
        ["tab", "Dados extraídos", "valores lidos"],
      ] as const) {
        const acao = page.getByRole(papel, { name: nome, exact: true });
        const dica = page.getByRole("tooltip").filter({ hasText: texto });
        await acao.hover();
        await expect(dica).toBeVisible();
        await page.mouse.move(1, 1);
        await expect(dica).toBeHidden();
        await page.keyboard.press("Tab");
        await acao.focus();
        await expect(dica).toBeVisible();
        await page.keyboard.press("Escape");
        // O Astryx apresenta também a dica de navegação por setas ao entrar na lista de abas.
        if (papel === "tab" && (await dica.isVisible()))
          await page.keyboard.press("Escape");
        await expect(dica).toBeHidden();
        await acao.blur();
      }
    },
  );
}
