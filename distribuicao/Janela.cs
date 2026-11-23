using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class Janela : Form {
    const string Nome = "SIPROQUIM Rodogarcia";
    readonly WebView2 pagina = new WebView2();
    readonly Uri inicio;
    readonly string perfil;
    readonly System.Windows.Forms.Timer sinais = new System.Windows.Forms.Timer();
    bool barraEscura;

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr janela, int atributo, ref int valor, int tamanho);

    void AtualizarBarra() {
        if (!IsHandleCreated) return;
        int escura = barraEscura && !SystemInformation.HighContrast ? 1 : 0;
        int fundo = SystemInformation.HighContrast ? -1 : (barraEscura ? 0x252525 : 0xffffff);
        int texto = SystemInformation.HighContrast ? -1 : (barraEscura ? 0xffffff : 0x191919);
        const int modoEscuro = 20, corDaBarra = 35, corDoTexto = 36;
        DwmSetWindowAttribute(Handle, modoEscuro, ref escura, sizeof(int));
        DwmSetWindowAttribute(Handle, corDaBarra, ref fundo, sizeof(int));
        DwmSetWindowAttribute(Handle, corDoTexto, ref texto, sizeof(int));
    }

    protected override void OnSystemColorsChanged(EventArgs e) {
        base.OnSystemColorsChanged(e);
        AtualizarBarra();
    }

    Janela(Uri inicio, string perfil, EventWaitHandle ativar, EventWaitHandle fechar) {
        this.inicio = inicio;
        this.perfil = perfil;
        Text = Nome;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.Manual;
        Size = new Size(1200, 800);
        Centralizar(Screen.FromPoint(Cursor.Position).WorkingArea);
        pagina.Dock = DockStyle.Fill;
        Controls.Add(pagina);
        Shown += async (s, e) => {
            try { await Carregar(); }
            catch (Exception erro) {
                if (IsDisposed || Disposing) return;
                MessageBox.Show(this, erro.Message, Nome, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        };
        sinais.Interval = 200;
        sinais.Tick += (s, e) => {
            if (fechar.WaitOne(0)) { Close(); return; }
            if (ativar.WaitOne(0)) {
                if (WindowState == FormWindowState.Minimized) {
                    var area = Screen.FromHandle(Handle).WorkingArea;
                    WindowState = FormWindowState.Normal;
                    Centralizar(area);
                }
                Activate();
            }
        };
        sinais.Start();
    }

    void Centralizar(Rectangle area) {
        int largura = Math.Min(Width, area.Width);
        int altura = Math.Min(Height, area.Height);
        Bounds = new Rectangle(area.Left + (area.Width - largura) / 2,
                               area.Top + (area.Height - altura) / 2, largura, altura);
    }

    protected override void Dispose(bool disposing) {
        if (disposing) sinais.Dispose();
        base.Dispose(disposing);
    }

    static void AbrirLinkExterno(Uri url) {
        if ((url.Scheme == "https" && (url.Host == "www.gov.br" || url.Host == "www.linkedin.com")) ||
            (url.Scheme == "mailto" && url.AbsoluteUri == "mailto:lucasmac.dev@gmail.com")) {
            Process.Start(new ProcessStartInfo(url.AbsoluteUri) { UseShellExecute = true });
        }
    }

    static bool TemWebView() {
        try { return !String.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString()); }
        catch (WebView2RuntimeNotFoundException) { return false; }
    }

    async Task Carregar() {
        if (!TemWebView()) {
            Text = Nome + " · Preparando a primeira abertura";
            string setup = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MicrosoftEdgeWebView2Setup.exe");
            using (var processo = Process.Start(new ProcessStartInfo(setup, "/silent /install") { UseShellExecute = false })) {
                await Task.Run(() => processo.WaitForExit());
            }
            if (!TemWebView()) {
                throw new InvalidOperationException("O Windows precisa do Microsoft Edge WebView2. Conecte o computador à internet e abra o SIPROQUIM novamente pelo atalho.");
            }
            Text = Nome;
        }
        var ambiente = await CoreWebView2Environment.CreateAsync(null, Path.Combine(perfil, "janela"));
        if (IsDisposed) return;
        await pagina.EnsureCoreWebView2Async(ambiente);
        if (IsDisposed) return;
        var web = pagina.CoreWebView2;
        web.WebMessageReceived += (s, e) => {
            Uri origem;
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out origem) ||
                origem.GetLeftPart(UriPartial.Authority) != inicio.GetLeftPart(UriPartial.Authority)) return;
            if (e.WebMessageAsJson == "\"tema:dark\"") barraEscura = true;
            else if (e.WebMessageAsJson == "\"tema:light\"") barraEscura = false;
            else return;
            AtualizarBarra();
        };
        web.NewWindowRequested += (s, e) => {
            e.Handled = true;
            Uri alvo;
            if (e.IsUserInitiated && Uri.TryCreate(e.Uri, UriKind.Absolute, out alvo)) AbrirLinkExterno(alvo);
        };
        web.NavigationStarting += (s, e) => {
            Uri alvo;
            if (Uri.TryCreate(e.Uri, UriKind.Absolute, out alvo) &&
                alvo.GetLeftPart(UriPartial.Authority) == inicio.GetLeftPart(UriPartial.Authority)) return;
            e.Cancel = true;
            if (e.IsUserInitiated && alvo != null) AbrirLinkExterno(alvo);
        };
        web.Navigate(inicio.AbsoluteUri);
    }

    static int Instalar(string pacote, string destino) {
        string msiexec = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "msiexec.exe");
        string argumentos = "/i \"" + pacote + "\" /qn /norestart INSTALLDIR=\"" + destino + "\"";
        var inicio = new ProcessStartInfo(msiexec, argumentos) { UseShellExecute = false, CreateNoWindow = true };
        try {
            using (var processo = Process.Start(inicio)) {
                processo.WaitForExit();
                return processo.ExitCode;
            }
        } catch (System.ComponentModel.Win32Exception) {
            return 1601;
        }
    }

    [STAThread] static int Main(string[] args) {
        if (args.Length == 3 && args[0] == "--instalar") return Instalar(args[1], args[2]);
        string porta = Environment.GetEnvironmentVariable("SIPROQUIM_PORTA");
        string perfil = Environment.GetEnvironmentVariable("SIPROQUIM_PERFIL");
        string versao = Environment.GetEnvironmentVariable("SIPROQUIM_VERSAO");
        string chave = porta + "." + versao;
        try {
            bool primeira;
            using (var ativar = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\Siproquim.Ativar." + chave))
            using (var unica = new Mutex(true, @"Local\Siproquim.Janela." + chave, out primeira)) {
                if (!primeira) { ativar.Set(); return 0; }
                using (var fechar = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\Siproquim.Fechar." + chave)) {
                    SetProcessDPIAware();
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    // Cada versão abre o próprio HTML, mesmo com o perfil do WebView preservado.
                    var url = new Uri("http://127.0.0.1:" + porta + "/?v=" + Uri.EscapeDataString(versao));
                    using (var janela = new Janela(url, perfil, ativar, fechar))
                        Application.Run(janela);
                }
            }
            return 0;
        } catch (Exception erro) {
            MessageBox.Show(erro.Message, Nome, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
