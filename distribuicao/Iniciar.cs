using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Iniciar {
    static readonly string Versao = Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
    static readonly string Perfil = Environment.GetEnvironmentVariable("SIPROQUIM_PERFIL")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Rodogarcia", "Siproquim");
    static readonly string Dados = Path.Combine(Perfil, "database");
    static readonly string Porta = Environment.GetEnvironmentVariable("SIPROQUIM_PORTA") ?? "18765";
    static readonly string Url = "http://127.0.0.1:" + Porta;
    static string Consultar(string rota, bool post) {
        string token = Path.Combine(Dados, "api.token");
        if (!File.Exists(token)) return null;
        var pedido = (HttpWebRequest)WebRequest.Create(Url + "/api/desktop/" + rota);
        pedido.Proxy = null;
        pedido.Timeout = 1000;
        pedido.Headers["X-Siproquim-Token"] = File.ReadAllText(token).Trim();
        if (post) { pedido.Method = "POST"; pedido.ContentLength = 0; }
        try {
            using (var resposta = pedido.GetResponse())
            using (var leitor = new StreamReader(resposta.GetResponseStream())) return leitor.ReadToEnd();
        } catch (WebException) { return null; }
    }
    static string Extrair() {
        string origem = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "sistema.zip");
        string raiz = Path.Combine(Perfil, "versoes");
        string destino = Path.Combine(raiz, Versao);
        if (Directory.Exists(destino)) return destino;
        Directory.CreateDirectory(raiz);
        string parcial = Path.Combine(raiz, Guid.NewGuid().ToString("N"));
        try {
            ZipFile.ExtractToDirectory(origem, parcial);
            Directory.Move(parcial, destino);
        } finally {
            if (Directory.Exists(parcial)) Directory.Delete(parcial, true);
        }
        return destino;
    }
    static void Abrir() {
        string atual = Consultar("versao", false);
        if (atual != Versao) {
            string dir = Extrair();
            if (atual != null) {
                EventWaitHandle janela;
                if (EventWaitHandle.TryOpenExisting(@"Local\Siproquim.Fechar." + Porta + "." + atual, out janela)) {
                    using (janela) janela.Set();
                }
                Consultar("encerrar", true);
                for (int i = 0; i < 60 && Consultar("versao", false) != null; i++) Thread.Sleep(250);
            }
            string downloads = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
                "{374DE290-123F-4565-9164-39C4925E467B}", null) as string;
            var java = new ProcessStartInfo(Path.Combine(dir, "java", "bin", "javaw.exe"), "-jar sistema.jar") {
                WorkingDirectory = dir, UseShellExecute = false, CreateNoWindow = true
            };
            java.EnvironmentVariables["SIPROQUIM_PORTA"] = Porta;
            java.EnvironmentVariables["SIPROQUIM_DADOS"] = Dados;
            java.EnvironmentVariables["SIPROQUIM_EXTRATOR"] = Path.Combine(dir, "extrair.py");
            java.EnvironmentVariables["SIPROQUIM_PYTHON"] = Path.Combine(dir, "python", "python.exe");
            java.EnvironmentVariables["SIPROQUIM_DESKTOP"] = "true";
            java.EnvironmentVariables["SIPROQUIM_ATALHO"] = Assembly.GetExecutingAssembly().Location;
            java.EnvironmentVariables["SIPROQUIM_JANELA"] = Path.Combine(dir, "desktop", "Siproquim.Desktop.exe");
            java.EnvironmentVariables["SIPROQUIM_VERSAO"] = Versao;
            java.EnvironmentVariables["SPRING_WEB_RESOURCES_STATIC_LOCATIONS"] = new Uri(Path.Combine(dir,"web") + Path.DirectorySeparatorChar).AbsoluteUri;
            java.EnvironmentVariables.Remove("SIPROQUIM_TOKEN");
            if (!String.IsNullOrEmpty(downloads) && String.IsNullOrEmpty(Environment.GetEnvironmentVariable("SIPROQUIM_DOWNLOADS")))
                java.EnvironmentVariables["SIPROQUIM_DOWNLOADS"] = Environment.ExpandEnvironmentVariables(downloads);
            using (var processo = Process.Start(java)) {
                for (int i = 0; i < 160 && !processo.HasExited; i++) {
                    if (Consultar("versao", false) == Versao) break;
                    Thread.Sleep(250);
                }
                if (Consultar("versao", false) != Versao)
                    throw new IOException("O serviço local não iniciou na porta " + Porta + ".");
            }
        }
        if (Environment.GetEnvironmentVariable("SIPROQUIM_SEM_NAVEGADOR") != "1") {
            string pasta = Path.Combine(Extrair(), "desktop");
            var janela = new ProcessStartInfo(Path.Combine(pasta, "Siproquim.Desktop.exe")) {
                WorkingDirectory = pasta, UseShellExecute = false
            };
            janela.EnvironmentVariables["SIPROQUIM_PERFIL"] = Perfil;
            janela.EnvironmentVariables["SIPROQUIM_PORTA"] = Porta;
            janela.EnvironmentVariables["SIPROQUIM_VERSAO"] = Versao;
            using (Process.Start(janela)) { }
        }
    }
    [STAThread] static int Main() {
        try {
            using (var trava = new Mutex(false, @"Local\Siproquim.Rodogarcia.Iniciar." + Porta)) {
                try { if (!trava.WaitOne(60000)) throw new TimeoutException("Outro início está em andamento."); }
                catch (AbandonedMutexException) {}
                try { Abrir(); } finally { trava.ReleaseMutex(); }
            }
            return 0;
        } catch (Exception e) {
            if (Environment.GetEnvironmentVariable("SIPROQUIM_SEM_NAVEGADOR") != "1")
                MessageBox.Show(e.Message, "SIPROQUIM · Rodogarcia", MessageBoxButtons.OK, MessageBoxIcon.Error);
            else Console.Error.WriteLine(e.Message);
            return 1;
        }
    }
}
