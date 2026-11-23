"""Instala duas versões de ensaio por usuário e reabre um PDF usando os runtimes do MSI."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import ctypes
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import uuid
import zipfile
from empacotar import MSI, RAIZ, VERSAO, montar_msi, guid


def windows_installer(*args):
    executavel = Path(os.environ["WINDIR"]) / "System32/msiexec.exe"
    subprocess.run([str(executavel), *map(str, args), "/qn", "/norestart"], check=True, timeout=180)


def validar(msi):
    familia = "{" + str(uuid.uuid4()).upper() + "}"
    nome = "SIPROQUIM Ensaio " + familia[1:9]
    with tempfile.TemporaryDirectory(prefix="siproquim-ensaio-", ignore_cleanup_errors=True) as temp:
        base = Path(temp)
        imagem = base / "imagem"
        windows_installer("/a", msi, "TARGETDIR=" + str(imagem))
        programa, = imagem.rglob("sistema.zip")
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
        env = dict(os.environ, SIPROQUIM_PERFIL=str(perfil), SIPROQUIM_PORTA=str(porta), SIPROQUIM_SEM_NAVEGADOR="1")
        for key in ["SIPROQUIM_TOKEN", "SIPROQUIM_CANAL", "SIPROQUIM_DADOS"]:
            env.pop(key, None)
        def api(rota, *, dados=None, headers=None):
            req = Request(url + rota, dados, {"X-Siproquim-UI": "local", **(headers or {})})
            with urlopen(req, timeout=15) as res:
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
        versoes = ["1.99.0", VERSAO]
        instalados = []
        destino = base / "instalado"
        try:
            for v in versoes:
                construcao = base / v
                construcao.mkdir()
                os.link(programa, construcao / "sistema.zip")
                pacote = construcao / MSI
                montar_msi(construcao, pacote, v, familia, nome)
                windows_installer("/i", pacote, "INSTALLDIR="+str(destino), "DesktopFolder="+str(base/"mesa"),
                                  "ProgramMenuFolder="+str(base/"menu"), "/l*v", base/(v+".log"))
                instalados.append(guid(familia, v))
                # O Windows pode resolver os diretórios de atalhos no perfil redirecionado.
                for csidl, pasta in [(16, "mesa"), (2, "menu")]:
                    local = ctypes.create_unicode_buffer(32768)
                    assert ctypes.windll.shell32.SHGetFolderPathW(None, csidl, None, 0, local) == 0
                    candidatos = [base / pasta, Path(local.value)]
                    assert any((c / (nome+".lnk")).is_file() for c in candidatos), f"Atalho ausente em {candidatos}"
                if v == versoes[0]:
                    env["SIPROQUIM_VERSAO"] = v  # simula uma instalação anterior com o mesmo esquema
                else:
                    env.pop("SIPROQUIM_VERSAO", None)
                subprocess.run([str(destino / "Siproquim.exe")], env=env, timeout=60, check=True)
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
                else:
                    reaberto = json.loads(api("/api/lotes/"+lote))
                    assert reaberto == resultado, "O lote mudou durante a atualização."
                    print("MSI validado: atalhos, dois runtimes, PDF de 6 páginas, atualização e lote preservado.")
        finally:
            fechar()
            for produto in reversed(instalados):
                proc = subprocess.run(["msiexec.exe", "/x", produto, "/qn", "/norestart"], timeout=90)
                if proc.returncode not in (0,1605): raise RuntimeError("Falha na limpeza do produto de ensaio.")
        assert (perfil / "database/mapas.sqlite").exists()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("instalador", type=Path)
    validar(p.parse_args().instalador.resolve(strict=True))
