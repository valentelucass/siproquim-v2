import { test, expect } from "./loteDeTeste";
for (const nome of ["Novo lote", "Prévia do TXT"]) {
  test(
    nome + " tem cabeçalho espaçado, foco e fechamento ao clicar fora",
    async ({ page }) => {
      await page.goto("/");
      await page.getByText("Campo localizado no PDF").waitFor();
      const trigger = page.getByRole("button", { name: nome, exact: true });
      await trigger.click();
      const modal = page.getByRole("dialog", { name: nome });
      const title = modal.getByText(nome, { exact: true }).first();
      await expect(modal).toBeVisible();
      const a = await modal.boundingBox(),
        b = await title.boundingBox();
      expect(b!.x - a!.x).toBeGreaterThanOrEqual(16);
      expect(b!.y - a!.y).toBeGreaterThanOrEqual(12);
      await page.mouse.click(10, 10);
      await expect(modal).toHaveCount(0);
      await expect(trigger).toBeFocused();
    },
  );
}
