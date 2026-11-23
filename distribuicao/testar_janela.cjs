// Testa o WebView2 instalado em um perfil isolado. A porta de inspeção existe apenas neste ensaio.
const { chromium, expect } = require("../frontend/node_modules/@playwright/test");
const { execFileSync } = require("node:child_process");
const { createServer } = require("node:net");
const { join } = require("node:path");
const { setTimeout: esperar } = require("node:timers/promises");

async function testar() {
  const [atalho, versao, etapa] = process.argv.slice(2);
  const reserva = createServer();
  await new Promise((ok, falha) => reserva.once("error", falha).listen(0, "127.0.0.1", ok));
  const porta = reserva.address().port;
  await new Promise(ok => reserva.close(ok));
  const env = {...process.env,
    SIPROQUIM_SEM_NAVEGADOR: "0",
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=" + porta,
    SIPROQUIM_JANELA_ENSAIO: join(process.env.SIPROQUIM_PERFIL, "versoes", versao, "desktop", "Siproquim.Desktop.exe")
  };
  const endpoint = "http://127.0.0.1:" + porta;
  const app = "http://127.0.0.1:" + env.SIPROQUIM_PORTA;
  function janela(acao) {
    const localizar = "$j=@([Diagnostics.Process]::GetProcessesByName('Siproquim.Desktop') | Where-Object {$_.MainModule.FileName -eq $env:SIPROQUIM_JANELA_ENSAIO}); ";
    return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", localizar + acao],
      {env, encoding:"utf8", windowsHide:true, timeout:20000}).trim();
  }
  const abrir = () => execFileSync(atalho, [], {env, stdio:"ignore", timeout:70000});
  const lerPosicao = `Add-Type -Namespace Teste -Name Posicao -MemberDefinition '
        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        public struct Rect { public int Left, Top, Right, Bottom; }
        [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out Rect r);
        [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool IsIconic(System.IntPtr h);
        [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetWindowPos(System.IntPtr h, System.IntPtr ordem, int x, int y, int largura, int altura, int flags);
        [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindowAsync(System.IntPtr h, int modo);'
      $null=[Teste.Posicao]::SetProcessDPIAware()
      Add-Type -AssemblyName System.Windows.Forms
      if ($j.Count -ne 1) {throw 'Janela ausente ou duplicada'}
      $h=$j[0].MainWindowHandle;`;
  function posicaoDaJanela() {
    return janela(lerPosicao + `
      $r=New-Object 'Teste.Posicao+Rect'
      $null=[Teste.Posicao]::GetWindowRect($h,[ref]$r)
      $a=[Windows.Forms.Screen]::FromHandle($h).WorkingArea
      $x=[math]::Abs($a.Left+$a.Right-$r.Left-$r.Right)
      $y=[math]::Abs($a.Top+$a.Bottom-$r.Top-$r.Bottom)
      if ((-not [Teste.Posicao]::IsIconic($h)) -and $x -le 20 -and $y -le 20) {Write-Output "Centralizada"}
      else {Write-Output "Deslocamento de centro em dobro: $x,$y. Janela $($r.Left),$($r.Top),$($r.Right),$($r.Bottom). Área $a"}`);
  }
  function conferirBarra(tema) {
    const valores = janela(`Add-Type -Name Dwm -Namespace Teste -MemberDefinition '[System.Runtime.InteropServices.DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(System.IntPtr janela, int atributo, out int valor, int tamanho);';
      if ($j.Count -ne 1) {throw 'Janela ausente'}
      $cor=0; $texto=0; $escura=0; $hwnd=$j[0].MainWindowHandle
      $hr=[Teste.Dwm]::DwmGetWindowAttribute($hwnd,35,[ref]$cor,4)
      if($hr -eq 0){
        if ([Teste.Dwm]::DwmGetWindowAttribute($hwnd,36,[ref]$texto,4) -ne 0){throw 'Cor de texto indisponível'}
        Write-Output "$cor,$texto"
      } else {
        if ([Teste.Dwm]::DwmGetWindowAttribute($hwnd,20,[ref]$escura,4) -ne 0){throw 'Tema da barra indisponível'}
        Write-Output "modo:$escura"
      }`);
    const escuro = tema === "dark";
    expect([escuro ? "modo:1" : "modo:0", escuro ? "2434341,16777215" : "16777215,1644825"]).toContain(valores);
  }
  const passos = etapa === "preparar" ? [[null, "dark"]]
    : [[etapa === "apos-atualizar" ? "dark" : null, "dark"], ["dark", "light"], ["light", null]];
  for (const [anterior, proximo] of passos) {
    let navegador;
    try {
      abrir();
      await expect.poll(async () => {
        try {return (await fetch(endpoint+"/json/list")).ok} catch {return false}
      }, {timeout:30000}).toBe(true);
      navegador = await chromium.connectOverCDP(endpoint);
      const contexto = navegador.contexts()[0];
      await expect.poll(() => contexto.pages().filter(p => p.url().startsWith(app + "/")).length, {timeout:20000}).toBe(1);
      const pagina = contexto.pages().find(p => p.url().startsWith(app + "/"));
      const tela = pagina.locator(".app");
      await expect(tela).toBeVisible();
      if (versao === require("../frontend/package.json").version)
        await expect.poll(posicaoDaJanela, {message:"Posição na abertura"}).toBe("Centralizada");
      if (anterior) {
        await expect(tela).toHaveAttribute("data-mode", anterior);
        conferirBarra(anterior);
      }
      if (proximo) {
        if ((await tela.getAttribute("data-mode")) === proximo)
          await pagina.getByRole("button", {name:proximo === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}).click();
        await pagina.getByRole("button", {name:proximo === "dark" ? "Ativar tema escuro" : "Ativar tema claro"}).click();
        await expect(tela).toHaveAttribute("data-mode", proximo);
        conferirBarra(proximo);
      }
      if (!proximo) {
        await pagina.getByRole("button", {name: "Passo a passo", exact: true}).click();
        const guia = pagina.getByRole("region", {name: "Passo a passo"});
        const avancar = guia.getByRole("button", {name: "Avançar"});
        const rodape = pagina.locator("footer");
        for (let passo = 1; passo <= 12; passo++) {
          await expect(guia.getByText(`Passo ${passo} de 13`)).toBeVisible();
          if (passo === 5 || passo === 12) {
            await expect.poll(() =>
              rodape.evaluate(el => Math.abs(innerHeight - el.getBoundingClientRect().bottom)),
              {message: `Rodapé no fim da janela no passo ${passo}`},
            ).toBeLessThanOrEqual(12);
          }
          if (passo < 12) await avancar.click();
        }
        await pagina.keyboard.press("Escape");
        await expect(guia).toHaveCount(0);
        janela(lerPosicao + `
          $r=New-Object 'Teste.Posicao+Rect'
          $null=[Teste.Posicao]::GetWindowRect($h,[ref]$r)
          if(-not [Teste.Posicao]::SetWindowPos($h,[IntPtr]::Zero,($r.Left+80),$r.Top,0,0,21)){throw 'Falha ao deslocar janela'}
          if(-not [Teste.Posicao]::ShowWindowAsync($h,6)){throw 'Falha ao minimizar'}
        `);
        await expect.poll(() => janela(lerPosicao + "Write-Output ([Teste.Posicao]::IsIconic($h))")).toBe("True");
      }
      abrir();
      if (!proximo) await expect.poll(posicaoDaJanela, {message:"Posição ao restaurar pelo atalho"}).toBe("Centralizada");
      await esperar(500);
      expect(janela("if ($j.Count -eq 1) { $j[0].MainWindowTitle }")).toBe("SIPROQUIM Rodogarcia");
    } finally {
      janela("foreach($p in $j){$null=$p.CloseMainWindow(); if(-not $p.WaitForExit(12000)){throw 'A janela não fechou'}}");
      if (navegador?.isConnected()) await navegador.close();
    }
  }
  console.log(etapa === "preparar" ? "Tema escuro escolhido antes da atualização."
    : "Janela desktop única e temas escuro e claro preservados entre aberturas.");
}
testar().catch(erro => {console.error(erro); process.exitCode=1;});
