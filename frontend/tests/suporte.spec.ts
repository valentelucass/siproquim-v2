import { expect, test } from "@playwright/test";
import { test as comLote } from "./loteDeTeste";
import type { Resultado } from "../src/api";

comLote("o suporte inclui todas as pendências e operações prontas mesmo com a fila filtrada", async ({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  const resposta = page.waitForResponse(r => /\/api\/lotes\/[\da-f-]+$/.test(r.url()) && r.ok());
  await page.goto("/");
  const lote: Resultado = await (await resposta).json();
  await page.getByRole("button",{name:"Copiar informações para o desenvolvedor"}).waitFor();
  await page.getByPlaceholder(/Buscar nota ou campo/).fill("não existe");
  await page.getByRole("button",{name:"Copiar informações para o desenvolvedor"}).click();
  const texto = await page.evaluate(()=>navigator.clipboard.readText());
  expect(texto).toContain("Conferência do lote");
  expect(lote.pendencias.length).toBeGreaterThan(0);
  for (const p of lote.pendencias) expect(texto).toContain(p.motivo);
  for (const op of lote.lote.operacoes)
    expect(texto).toContain("Op. " + op.id + " · NF " + op.original.nf + " · pág. " + op.paginas.join(", "));
  expect(texto).toContain("Sem pendências nas regras locais");
  expect(texto).toContain("Verificações atendidas");
  expect(texto).toContain("CARIMBO");
  expect(texto).not.toMatch(/11222333000181|11\.222\.333\/0001-81|ORIGEM DEMONSTRACAO/i);
});

for (const tema of ["light", "dark"] as const) {
  test("modal de atualização mantém recuo e separação das ações em " + tema, async ({page}) => {
    await page.emulateMedia({colorScheme:tema});
    await page.route("**/api/atualizacoes", r => r.fulfill({json:{disponivel:null}}));
    await page.goto("/");
    await page.locator("footer button").click();
    const dialogo = page.getByRole("dialog", {name:"Atualizações do sistema"});
    const estado = dialogo.getByText(/Você já está usando a versão mais recente/);
    await expect(estado).toBeVisible();
    const corpo = await estado.boundingBox(), janela = await dialogo.boundingBox();
    const botao = await dialogo.getByRole("button",{name:"Verificar novamente"}).boundingBox();
    const fundo = dialogo.locator(".update-icon");
    const caixa = await fundo.boundingBox(), icone = await fundo.locator("svg").boundingBox();
    expect(Math.abs((icone!.x + icone!.width / 2) - (caixa!.x + caixa!.width / 2))).toBeLessThan(1);
    expect(corpo!.x - janela!.x).toBeGreaterThanOrEqual(18);
    expect(botao!.y - corpo!.y - corpo!.height).toBeGreaterThanOrEqual(14);
  });
}

test("um clique copia o erro e o caminho técnico sem o nome do PDF nem a evidência", async ({page,context}) => {
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button",{name:"Novo lote"}).click();
  await page.getByRole("button",{name:/^Filial declarante/}).click();
  await page.getByRole("option",{name:/CPQ · Rodogarcia/i}).click();
  await page.getByLabel("Competência",{exact:true}).fill("2026-10");
  await page.getByLabel("Relatório PDF").setInputFiles({name:"cliente-privado.pdf",mimeType:"application/pdf",buffer:Buffer.from("arquivo fictício inválido %PDF-")});
  await page.getByRole("button",{name:"Criar lote"}).click();
  await expect(page.getByRole("alert")).toContainText(/cabeçalho PDF/);
  await page.getByRole("button",{name:"Cancelar"}).click();
  await page.getByRole("button",{name:"Copiar informações para o desenvolvedor"}).click();
  await expect(page.getByRole("status").filter({hasText:"Informações copiadas"})).toBeVisible();
  const relatorio = await page.evaluate(()=>navigator.clipboard.readText());
  expect(relatorio).toMatch(/POST \/api\/lotes · HTTP 422/);
  expect(relatorio).toContain("ExtratorPdf.extrair:");
  expect(relatorio).toContain("cabeçalho PDF");
  expect(relatorio).toContain("Novo lote");
  expect(relatorio).not.toMatch(/cliente-privado|60960473000758|arquivo fictício inválido|X-Siproquim-Token/i);
});

test("a cópia manual funciona com o serviço fora do ar e preserva o relatório", async ({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:undefined}));
  await page.route("**/api/lotes", r=>r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.getByRole("button",{name:"Copiar informações para o desenvolvedor"}).click();
  const dialogo=page.getByRole("dialog",{name:"Copiar informações para o desenvolvedor"});
  const texto=dialogo.getByRole("textbox",{name:"Relatório de suporte"});
  await expect(texto).toHaveValue(/Sem resposta da API/);
  await dialogo.getByRole("button",{name:"Selecionar texto"}).click();
  expect(await texto.evaluate((el:HTMLTextAreaElement)=>el.selectionEnd-el.selectionStart)).toBe((await texto.inputValue()).length);
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
});
