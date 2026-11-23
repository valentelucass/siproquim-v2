import { expect, test } from "@playwright/test";

for (const tema of ["dark", "light"] as const) {
  test("nova versão avisa na tela e continua no rodapé em " + tema, async ({ page }) => {
    await page.emulateMedia({colorScheme: tema});
    await page.route("**/api/atualizacoes", r => r.fulfill({json: {instalada: "2.0.0", disponivel: "2.1.0"}}));
    let tentativas = 0;
    await page.route("**/api/atualizacoes/2.1.0", r => {
      expect(r.request().method()).toBe("POST");
      return ++tentativas === 1 ? r.fulfill({status: 503, json: {mensagem: "Download interrompido."}})
        : r.fulfill({json: {iniciado: true, caminho: "Downloads/teste.msi"}});
    });
    await page.goto("/");
    const modal = page.getByRole("dialog", {name: "Atualização disponível"});
    await expect(modal).toBeVisible();
    await expect(modal.locator(".update-version")).toContainText("2.0.0");
    await modal.getByRole("button", {name: "Agora não"}).click();
    await expect(modal).toHaveCount(0);
    const footer = page.getByRole("contentinfo").or(page.locator("footer")).first();
    await footer.getByRole("button", {name: "Atualizar para 2.1.0"}).click();
    const instalar = modal.getByRole("button", {name: "Atualizar agora"});
    await instalar.click();
    await expect(modal.getByText("Download interrompido.")).toBeVisible();
    await instalar.click();
    await expect(modal.getByText("Atualização instalada", {exact:true})).toBeVisible();
    await expect(modal.getByText(/Reabrindo o SIPROQUIM/)).toBeVisible();
    await expect(instalar).toBeDisabled();
    await expect(footer.getByRole("link", {name: /Lucas Andrade/})).toHaveAttribute("href", /linkedin\.com\/in\/dev-lucasandrade/);
  });
}
test("consulta sem internet permite tentar novamente e não interrompe a conferência", async ({page}) => {
  let online = false;
  const consultasManuais: string[] = [];
  await page.route(/\/api\/atualizacoes(?:\?forcar=true)?$/, r => {
    const forcar = new URL(r.request().url()).searchParams.get("forcar");
    if (forcar) consultasManuais.push(forcar);
    return online ? r.fulfill({json:{disponivel:null}}) : r.fulfill({status:503});
  });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("footer button").click();
  await expect(page.getByText(/Não foi possível consultar as atualizações/)).toBeVisible();
  online = true;
  await page.getByRole("button", {name:"Verificar novamente"}).click();
  await expect(page.getByText(/já está usando a versão mais recente/)).toBeVisible();
  expect(consultasManuais).toEqual(["true", "true"]);
});
test("uma versão publicada durante a conferência avisa uma vez e segue disponível para depois", async ({page}) => {
  let disponivel: string | null = null;
  let consultas = 0;
  await page.clock.install();
  await page.route("**/api/atualizacoes", r => {
    consultas++;
    return r.fulfill({json:{disponivel}});
  });
  await page.goto("/");
  await expect.poll(() => consultas).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  disponivel = "2.0.1";
  await page.clock.fastForward(30_001);
  await expect(page.getByRole("dialog", {name:"Atualização disponível"})).toBeVisible();
  await page.getByRole("button", {name:"Agora não"}).click();
  await page.clock.fastForward(30_001);
  await expect.poll(() => consultas).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("footer").getByRole("button", {name:"Atualizar para 2.0.1"})).toBeVisible();
});
