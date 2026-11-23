import { selecionarFilial } from "./filial";
import { test, expect } from "./loteDeTeste";
import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Resultado } from "../src/api";

const pasta = process.env.SIPROQUIM_UI_ACERVO;
const esperados: Record<string, number> = {
  "00000097": 1187,
  "00000113": 9,
  "00000114": 13,
  "00000115": 14,
  "00000116": 74,
  "00000150": 234,
  "00000220": 23,
  "00000343": 194,
  "00000403": 127,
};
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

if (pasta) {
  const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" })
    .filter((n) => n.toLowerCase().endsWith(".pdf"))
    .map((n) => join(pasta, n))
    .sort((a, b) => statSync(a).size - statSync(b).size);
  if (!arquivos.length) throw Error("A pasta do ensaio precisa conter PDFs.");
  for (const arquivo of arquivos) {
    const id = arquivo.split(/[\\/]/).pop()!.slice(0, 8);
    test(
      "importação do acervo e visualizador — amostra " + id,
      async ({ page }) => {
        test.setTimeout(15 * 60 * 1000);
        const erros: string[] = [];
        page.on("pageerror", (e) => erros.push(e.name));
        await page.goto("/");
        await page.getByText("Campo localizado no PDF").waitFor();
        await page.getByRole("button", { name: "Novo lote" }).click();
        await selecionarFilial(
          page,
          id === "00000113" ? "CAS · Rodogarcia" : id === "00000220" ? "CWB · Rodogarcia" : "CPQ · Rodogarcia",
        );
        const periodo: Record<string, string> = {
          "00000220": "2026-02",
          "00000343": "2026-03",
          "00000403": "2026-08",
        };
        await page
          .getByLabel("Competência", { exact: true })
          .fill(periodo[id] || "2026-01");
        const pdf = await readFile(arquivo);
        await page.getByLabel("Relatório PDF").setInputFiles({
          name: id + ".pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        });
        const retorno = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/lotes") && r.request().method() === "POST",
          { timeout: 180000 },
        );
        await page.getByRole("button", { name: "Criar lote" }).click();
        const resp = await retorno;
        if (id === "00000019") {
          expect(resp.status()).toBe(422);
          await expect(
            page.getByRole("dialog").getByRole("alert"),
          ).toBeVisible();
          const lista = await page.request.get("/api/lotes", {
            headers: { "X-Siproquim-UI": "local" },
          });
          expect(lista.ok()).toBeTruthy();
          expect(
            (await lista.json()).some(
              (l: { nome: string }) => l.nome === id + ".pdf",
            ),
          ).toBe(false);
          return;
        }
        expect(resp.status()).toBe(200);
        // O Edge pode descartar respostas grandes do cache do inspetor.
        const headers = { "X-Siproquim-UI": "local" };
        const list = await page.request.get("/api/lotes", { headers });
        expect(list.ok()).toBeTruthy();
        const entry = (await list.json()).find(
          (l: { nome: string }) => l.nome === id + ".pdf",
        );
        expect(entry).toBeTruthy();
        const detalhe = await page.request.get("/api/lotes/" + entry.id, {
          headers,
        });
        expect(detalhe.ok()).toBeTruthy();
        const { lote, pendencias }: Resultado = await detalhe.json();
        if (id === "00000113") {
          await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.getByRole("button", {name: "Copiar informações para o desenvolvedor"}).click();
          const texto = await page.evaluate(() => navigator.clipboard.readText());
          expect(pendencias).toHaveLength(21);
          expect(texto.match(/^  A revisar:/gm)?.length).toBe(pendencias.length);
          expect(texto.match(/^Op\. /gm)?.length).toBe(lote.operacoes.length);
          expect(texto.match(/^  Verificações atendidas:/gm)?.length).toBe(lote.operacoes.length);
          for (const p of pendencias) {
            const bloco = texto.split("\nOp. " + p.operacao + " · ")[1]?.split("\nOp. ")[0] ?? "";
            expect(bloco.includes("[" + p.campo + "]") && bloco.includes(p.motivo)).toBe(true);
          }
        }
        expect(lote.paginas).toBeGreaterThan(0);
        if (esperados[id]) expect(lote.paginas).toBe(esperados[id]);
        const cobertas = new Set(lote.operacoes.flatMap((o) => o.paginas));
        expect([...cobertas].sort((a, b) => a - b)).toEqual(
          Array.from({ length: lote.paginas }, (_, i) => i + 1),
        );
        await expect(page.locator(".summarystrip")).toContainText(id + ".pdf", {
          timeout: 60000,
        });
        await page.locator(".sheet canvas").waitFor({ timeout: 30000 });
        await expect(page.locator(".pdfloading")).toHaveCount(0, {
          timeout: 30000,
        });
        if (id === "00000150" || id === "00000220") {
          const unico = id === "00000220";
          const nf = unico ? "385528" : "405387";
          const busca = page.getByRole("textbox", {
            name: "Buscar nota ou campo",
          });
          await busca.fill(nf);
          const item = page.getByRole("button", {
            name: new RegExp("Recebedor.*" + nf),
          });
          if ((await item.getAttribute("aria-expanded")) !== "true")
            await item.click();
          await expect(
            page.getByLabel("PDF original, página " + (unico ? 2 : 62), {
              exact: true,
            }),
          ).toBeVisible();
          if (unico)
            await expect(page.getByTestId("destaque-pdf")).toBeVisible();
          else {
            // A mesma NF e o mesmo recebedor aparecem em três blocos da página 62.
            await expect(
              page.getByText(
                "Página da operação. Confira o campo visualmente.",
              ),
            ).toBeVisible();
            await expect(page.getByTestId("destaque-pdf")).toHaveCount(0);
          }
          await busca.fill("");
        }
        const espera = page.waitForEvent("download");
        await page.getByRole("button", { name: "Baixar PDF original" }).click();
        expect(sha(await readFile((await (await espera).path())!))).toBe(
          sha(pdf),
        );

        // Aciona os mesmos controles da operadora. Aguarda a pintura da folha
        // e verifica presença de conteúdo a cada página antes de avançar.
        const paginas = await page.evaluate(async (total) => {
          const frame = () =>
            new Promise<void>((r) => requestAnimationFrame(() => r()));
          const anterior = document.querySelector<HTMLButtonElement>(
            'button[aria-label="Página anterior"]',
          )!;
          const proxima = document.querySelector<HTMLButtonElement>(
            'button[aria-label="Próxima página"]',
          )!;
          const thumb = document.createElement("canvas");
          thumb.width = 72;
          thumb.height = 100;
          const ctx = thumb.getContext("2d", { willReadFrequently: true })!;
          async function pintada(n: number) {
            const prazo = performance.now() + 25000;
            for (;;) {
              await frame();
              await frame();
              if (document.querySelector(".canvasarea [role=alert]"))
                throw Error("Erro de leitura na página " + n);
              const c = document.querySelector<HTMLCanvasElement>(
                '.sheet canvas[aria-label="PDF original, página ' + n + '"]',
              );
              if (c && c.width > 10 && !document.querySelector(".pdfloading")) {
                ctx.drawImage(c, 0, 0, thumb.width, thumb.height);
                const px = ctx.getImageData(
                  0,
                  0,
                  thumb.width,
                  thumb.height,
                ).data;
                let min = 255,
                  max = 0;
                for (let i = 0; i < px.length; i += 4) {
                  min = Math.min(min, px[i]);
                  max = Math.max(max, px[i]);
                }
                if (max - min > 12) return;
              }
              if (performance.now() > prazo)
                throw Error("Sem conteúdo renderizado na página " + n);
            }
          }
          let atual = Number(
            document.querySelector(".pdfcontrols b")!.textContent,
          );
          while (atual > 1) {
            anterior.click();
            await pintada(--atual);
          }
          for (let n = 1; n <= total; n++) {
            if (n > 1) proxima.click();
            await pintada(n);
          }
          if (!proxima.disabled)
            throw Error("Navegação passou da última página.");
          return total;
        }, lote.paginas);
        await page.getByRole("tab", { name: "Dados extraídos" }).click();
        await expect(
          page.getByRole("table", { name: "Dados extraídos da operação" }),
        ).toBeVisible();
        if (pendencias.length) {
          await page.getByRole("button", { name: "Prévia do TXT" }).click();
          await expect(
            page.getByRole("dialog").getByText(/campos? para revisar/),
          ).toBeVisible();
          await expect(
            page
              .getByRole("dialog")
              .getByRole("button", { name: "Exportar TXT" }),
          ).toBeDisabled();
          if (id === "00000113") {
            const previa = page.getByRole("dialog");
            await expect(previa).toContainText("21 campos para revisar");
            await expect(previa).toContainText("3 de 21 operações prontas");
            const notas = previa.getByRole("group", { name: /^NF / });
            await previa.getByRole("tab", { name: "Prontas (3)" }).click();
            await expect(notas).toHaveCount(3);
            await expect(notas.filter({ hasText: "11956" })).toContainText("Pág. 4");
            await previa.getByRole("tab", { name: "Para revisar (18)" }).click();
            await expect(notas).toHaveCount(18);
            const nota = previa.getByRole("group", { name: "NF 11922", exact: true });
            await expect(nota.getByRole("button")).toHaveCount(2);
            await nota.getByRole("button", { name: /CPF\/CNPJ/ }).click();
            await expect(previa).toHaveCount(0);
            await expect(page.locator(".issuecard.current")).toContainText("11922");
          }
        }
        expect(erros).toEqual([]);
        console.log(
          "ACERVO",
          id,
          "páginas",
          paginas,
          "operações",
          lote.operacoes.length,
          "pendências",
          pendencias.length,
        );
      },
    );
  }
}
