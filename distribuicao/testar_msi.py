"""Instala duas versões de ensaio por usuário e reabre um PDF usando os runtimes do MSI."""
import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path
import ctypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import socket
import struct
import subprocess
import tempfile
from threading import Thread
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import uuid
import zipfile
from msilib import CreateRecord, MSIDBOPEN_READONLY, MSIDBOPEN_TRANSACT, OpenDatabase
from empacotar import MSI, RAIZ, VERSAO, compilar_atalho, montar_msi, guid


def windows_installer(*args):
    executavel = Path(os.environ["WINDIR"]) / "System32/msiexec.exe"
    def argumento(valor):
        chave, igual, dado = str(valor).partition("=")
        if igual and chave in {"INSTALLDIR", "TARGETDIR", "DesktopFolder", "ProgramMenuFolder"}:
            return f'{chave}="{dado}"'
        return subprocess.list2cmdline([str(valor)])
    cmd = " ".join(map(argumento, (executavel, *args, "/qn", "/norestart")))
    subprocess.run(cmd, executable=executavel, check=True, timeout=180)


def coluna_msi(msi, consulta):
    db = OpenDatabase(str(msi), MSIDBOPEN_READONLY)
    view = db.OpenView(consulta)
    view.Execute(None)
    return [row.GetString(1) for row in iter(view.Fetch, None)]


def validar_icone(msi, executavel):
    nome = "siproquim.ico"
    assert coluna_msi(msi, "SELECT `Name` FROM `Icon`") == [nome]
    assert coluna_msi(msi, "SELECT `Icon_` FROM `Shortcut`") == [nome, nome]
    assert coluna_msi(msi, "SELECT `Value` FROM `Property` WHERE `Property`='ARPPRODUCTICON'") == [nome]
    ico = (RAIZ / "distribuicao" / nome).read_bytes()
    pe = executavel.read_bytes()
    _, tipo, quantidade = struct.unpack_from("<HHH", ico)
    assert tipo == 1 and quantidade >= 2
    for i in range(quantidade):
        tamanho, inicio = struct.unpack_from("<II", ico, 6 + 16*i + 8)
        assert ico[inicio:inicio+tamanho] in pe, "Resolução do ícone ausente no executável"


def copiar_versoes_de_arquivo(origem, destino):
    """Preserva as regras de substituição de arquivos da release no MSI de ensaio."""
    db = OpenDatabase(str(destino), MSIDBOPEN_TRANSACT)
    for chave in ["Iniciar", "Pacote"]:
        versao, = coluna_msi(origem, f"SELECT `Version` FROM `File` WHERE `File`='{chave}'")
        view = db.OpenView(f"UPDATE `File` SET `Version`=? WHERE `File`='{chave}'")
        dados = CreateRecord(1)
        if versao:
            dados.SetString(1, versao)
        view.Execute(dados)
        view.Close()
    db.Commit()


class CanalEnsaio(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def validar(msi, anterior=None, via_atualizador=False):
    familia = "{" + str(uuid.uuid4()).upper() + "}"
    nome = "SIPROQUIM Ensaio " + familia[1:9]
    with tempfile.TemporaryDirectory(prefix="siproquim-ensaio-", ignore_cleanup_errors=True) as temp:
        base = Path(temp)
        imagem = base / "imagem"
        windows_installer("/a", msi, "TARGETDIR=" + str(imagem))
        programa, = imagem.rglob("sistema.zip")
        validar_icone(msi, programa.with_name("Siproquim.exe"))
        with zipfile.ZipFile(programa) as z:
            for componente, fonte in [("sistema.jar", "backend/java/target/siproquim-backend.jar"),
                                      ("web/index.html", "frontend/dist/index.html"), ("extrair.py","backend/python/extrair.py")]:
                assert hashlib.sha256(z.read(componente)).digest() == hashlib.sha256((RAIZ / fonte).read_bytes()).digest()
            assert not any(Path(n).name in {"api.token", "mapas.sqlite"} for n in z.namelist())
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            porta = s.getsockname()[1]
        url = f"http://127.0.0.1:{porta}"
        perfil = base / "perfil"
        env = dict(os.environ, SIPROQUIM_PERFIL=str(perfil), SIPROQUIM_PORTA=str(porta), SIPROQUIM_SEM_NAVEGADOR="1",
                   SIPROQUIM_DOWNLOADS=str(base / "Downloads"))
        for key in ["SIPROQUIM_TOKEN", "SIPROQUIM_DADOS"]:
            env.pop(key, None)
        env["SIPROQUIM_CANAL"] = url + "/canal-de-ensaio"
        def api(rota, *, dados=None, headers=None, timeout=15):
            req = Request(url + rota, dados, {"X-Siproquim-UI": "local", **(headers or {})})
            with urlopen(req, timeout=timeout) as res:
                return res.read()
        def fechar():
            chave = perfil / "database/api.token"
            if chave.exists():
                try:
                    api("/api/desktop/encerrar", dados=b"", headers={"X-Siproquim-Token":chave.read_text().strip()})
                    for _ in range(80):
                        time.sleep(.15)
                        try: api("/api/saude")
                        except OSError: break
                except OSError: pass
        anterior_zip = programa
        anterior_versao = "1.99.0"
        if anterior:
            anterior_versao, = coluna_msi(anterior, "SELECT `Value` FROM `Property` WHERE `Property`='ProductVersion'")
            assert tuple(map(int, anterior_versao.split("."))) < tuple(map(int, VERSAO.split(".")))
            windows_installer("/a", anterior, "TARGETDIR=" + str(base / "anterior"))
            anterior_zip, = (base / "anterior").rglob("sistema.zip")
        versoes = [anterior_versao, VERSAO]
        with zipfile.ZipFile(anterior_zip) as z:
            anterior_com_janela = "desktop/Siproquim.Desktop.exe" in z.namelist()
        instalados = []
        destino = base / "Instalação do ensaio"
        canal = None
        if via_atualizador:
            pasta_canal = base / "canal"
            pasta_canal.mkdir()
            canal = ThreadingHTTPServer(("127.0.0.1", 0), partial(CanalEnsaio, directory=str(pasta_canal)))
            Thread(target=canal.serve_forever, daemon=True).start()
            env["SIPROQUIM_CANAL"] = f"http://127.0.0.1:{canal.server_port}"
        try:
            for v in versoes:
                construcao = base / v
                construcao.mkdir()
                origem_zip = anterior_zip if v == anterior_versao else programa
                os.link(origem_zip, construcao / "sistema.zip")
                if v == anterior_versao and not anterior:
                    compilar_atalho(construcao, v)
                else:
                    shutil.copyfile(origem_zip.with_name("Siproquim.exe"), construcao / "Siproquim.exe")
                pacote = construcao / MSI
                montar_msi(construcao, pacote, v, familia, nome)
                if anterior and v == anterior_versao:
                    copiar_versoes_de_arquivo(anterior, pacote)
                instalados.append(guid(familia, v))
                real = via_atualizador and v == VERSAO
                if real:
                    publicar = pasta_canal / "download" / ("v" + v)
                    publicar.mkdir(parents=True)
                    os.link(pacote, publicar / MSI)
                    subprocess.run(["pwsh", "-NoProfile", "-File", str(RAIZ / "distribuicao/Assinar.ps1"),
                                    "-Instalador", str(publicar / MSI), "-Versao", v], check=True)
                    ultimo = pasta_canal / "latest/download"
                    ultimo.mkdir(parents=True)
                    os.link(publicar / "atualizacao.json", ultimo / "atualizacao.json")
                    assert json.loads(api("/api/atualizacoes?forcar=true"))["disponivel"] == v
                    try:
                        retorno = json.loads(api("/api/atualizacoes/" + v, dados=b"", timeout=180))
                    except HTTPError as erro:
                        raise AssertionError("Atualizador HTTP " + str(erro.code) + ": " +
                                             erro.read(2048).decode("utf-8")) from erro
                    assert retorno["iniciado"]
                    limite = time.monotonic() + 40
                    while time.monotonic() < limite:
                        try:
                            if api("/api/desktop/versao", headers={"X-Siproquim-Token": token}).decode() == v:
                                break
                        except OSError:
                            pass
                        time.sleep(.2)
                    else:
                        raise AssertionError("O atualizador não abriu a nova versão.")
                    print("Atualização pelo aplicativo instalou e reabriu a nova versão.")
                else:
                    windows_installer("/i", pacote, "INSTALLDIR="+str(destino), "DesktopFolder="+str(base/"mesa"),
                                      "ProgramMenuFolder="+str(base/"menu"), "/l*v", base/(v+".log"))
                for arquivo in ["Siproquim.exe", "sistema.zip"]:
                    with (construcao / arquivo).open("rb") as novo, (destino / arquivo).open("rb") as instalado:
                        assert hashlib.file_digest(novo, "sha256").digest() == hashlib.file_digest(instalado, "sha256").digest(), f"{arquivo} instalado diverge da versão {v}."
                # O Windows pode resolver os diretórios de atalhos no perfil redirecionado.
                for csidl, pasta in [(16, "mesa"), (2, "menu")]:
                    local = ctypes.create_unicode_buffer(32768)
                    assert ctypes.windll.shell32.SHGetFolderPathW(None, csidl, None, 0, local) == 0
                    candidatos = [base / pasta, Path(local.value)]
                    assert any((c / (nome+".lnk")).is_file() for c in candidatos), f"Atalho ausente em {candidatos}"
                if v == versoes[0] and not anterior:
                    env["SIPROQUIM_VERSAO"] = v  # simula uma instalação anterior com o mesmo esquema
                else:
                    env.pop("SIPROQUIM_VERSAO", None)
                if not real:
                    subprocess.run([str(destino / "Siproquim.exe")], env=env, timeout=60, check=True)
                token = (perfil / "database/api.token").read_text().strip()
                em_execucao = api("/api/desktop/versao", headers={"X-Siproquim-Token": token}).decode()
                assert em_execucao == v, f"Era esperado o backend {v}, mas o atalho abriu {em_execucao}."
                assert "Conferência de fretes" in api("/").decode()
                assert len(json.loads(api("/api/filiais"))) == 19
                for rota, cabecalho in [("/api/desktop/versao", {}), ("/api/filiais", {"Origin":"https://example.invalid"})]:
                    try: api(rota, headers=cabecalho)
                    except HTTPError as erro: assert erro.code in (401, 403)
                    else: raise AssertionError("Pedido externo ou administrativo aceito")
                if v == versoes[0]:
                    pdf = (RAIZ / "frontend/public/fretes-demonstracao.pdf").read_bytes()
                    borda = uuid.uuid4().hex
                    parte = lambda h,b: ("--"+borda+"\r\nContent-Disposition: form-data; "+h+"\r\n\r\n").encode()+b+b"\r\n"
                    corpo = parte('name="cnpj"', b"11222333000181") + parte('name="competencia"', b"2026-10") + parte(
                        'name="arquivo"; filename="teste.pdf"\r\nContent-Type: application/pdf',pdf) + ("--"+borda+"--\r\n").encode()
                    resultado = json.loads(api("/api/lotes", dados=corpo, headers={"Content-Type":"multipart/form-data; boundary="+borda}))
                    lote = resultado["lote"]["id"]
                    assert resultado["lote"]["paginas"] == 6 and resultado["pendencias"]
                    if anterior_com_janela:
                        subprocess.run(["node", str(RAIZ / "distribuicao/testar_janela.cjs"),
                                        str(destino / "Siproquim.exe"), v, "preparar"], env=env, check=True, timeout=100)
                else:
                    reaberto = json.loads(api("/api/lotes/"+lote))
                    for antes, depois in zip(resultado["decisoes"], reaberto["decisoes"], strict=True):
                        if "camposAvaliados" not in antes:
                            assert depois.pop("camposAvaliados"), "Decisão sem rastreio das regras desta versão"
                    assert reaberto == resultado, "O lote mudou durante a atualização."
                    subprocess.run(["node", str(RAIZ / "distribuicao/testar_janela.cjs"),
                                    str(destino / "Siproquim.exe"), v, "apos-atualizar" if anterior_com_janela else "abrir"],
                                   env=env, check=True, timeout=180)
                    print(f"MSI validado: ícone, atalhos, PDF de 6 páginas e lote preservado de {anterior_versao} para {v}.")
        finally:
            fechar()
            if canal:
                canal.shutdown()
                canal.server_close()
            for produto in reversed(instalados):
                proc = subprocess.run(["msiexec.exe", "/x", produto, "/qn", "/norestart"], timeout=90)
                if proc.returncode not in (0,1605): raise RuntimeError("Falha na limpeza do produto de ensaio.")
        assert (perfil / "database/mapas.sqlite").exists()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("instalador", type=Path)
    p.add_argument("--anterior", type=Path, help="MSI da versão publicada que criará o lote inicial")
    p.add_argument("--via-atualizador", action="store_true", help="Testa o atualizador com canal local assinado e MSI isolado")
    args = p.parse_args()
    if args.via_atualizador and args.anterior:
        p.error("--via-atualizador simula a versão anterior com o atualizador desta compilação")
    validar(args.instalador.resolve(strict=True), args.anterior.resolve(strict=True) if args.anterior else None,
            args.via_atualizador)
