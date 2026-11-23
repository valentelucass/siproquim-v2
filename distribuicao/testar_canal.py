"""Confere se a versão anterior recebe e baixa a nova pelo canal público."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zipfile import ZipFile

from testar_msi import coluna_msi, windows_installer


def versao_msi(instalador):
    versao, = coluna_msi(instalador, "SELECT `Value` FROM `Property` WHERE `Property`='ProductVersion'")
    return versao


def testar(anterior, novo):
    versao_anterior = versao_msi(anterior)
    versao_nova = versao_msi(novo)
    with novo.open("rb") as esperado:
        sha256 = hashlib.file_digest(esperado, "sha256").hexdigest()

    with tempfile.TemporaryDirectory(prefix="siproquim-canal-") as temp:
        pasta = Path(temp)
        imagem = pasta / "imagem"
        windows_installer("/a", anterior, "TARGETDIR=" + str(imagem))
        pacote, = imagem.rglob("sistema.zip")
        with ZipFile(pacote) as zip_aplicacao:
            jar = zip_aplicacao.extract("sistema.jar", pasta)
        with socket.socket() as reserva:
            reserva.bind(("127.0.0.1", 0))
            porta = reserva.getsockname()[1]

        token = secrets.token_urlsafe(32)
        env = dict(os.environ, SIPROQUIM_PORTA=str(porta), SIPROQUIM_TOKEN=token,
                   SIPROQUIM_DADOS=str(pasta / "dados"), SIPROQUIM_DESKTOP="false",
                   SIPROQUIM_DOWNLOADS=str(pasta / "Downloads"))
        for nome in ("SIPROQUIM_CANAL", "SIPROQUIM_VERSAO"):
            env.pop(nome, None)

        def chamar(rota, metodo="GET", timeout=20):
            req = Request(f"http://127.0.0.1:{porta}/api/{rota}", method=metodo,
                          headers={"X-Siproquim-Token": token})
            with urlopen(req, timeout=timeout) as resposta:
                return json.load(resposta)

        processo = subprocess.Popen(["java", "-jar", jar], env=env, cwd=pasta, stdout=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            limite = time.monotonic() + 30
            while True:
                try:
                    if chamar("saude", timeout=2)["status"] == "ok":
                        break
                except URLError:
                    if processo.poll() is not None or time.monotonic() > limite:
                        raise RuntimeError("A versão anterior não iniciou.") from None
                time.sleep(.25)

            limite = time.monotonic() + 240
            ultima = "sem resposta"
            while time.monotonic() < limite:
                try:
                    estado = chamar("atualizacoes")
                    assert estado["instalada"] == versao_anterior, estado
                    ultima = estado["disponivel"]
                    if ultima == versao_nova:
                        break
                except HTTPError as erro:
                    ultima = f"HTTP {erro.code}"
                time.sleep(10)
            else:
                raise RuntimeError(f"A versão {versao_anterior} ainda não recebeu {versao_nova}. Última consulta: {ultima}.")

            retorno = chamar("atualizacoes/" + versao_nova, metodo="POST", timeout=180)
            assert retorno["iniciado"] is False
            baixado = Path(retorno["caminho"]).resolve(strict=True)
            assert baixado.parent == pasta.resolve() / "Downloads"
            with baixado.open("rb") as arquivo:
                assert hashlib.file_digest(arquivo, "sha256").hexdigest() == sha256
            print(f"Canal público: {versao_anterior} recebeu e verificou o instalador {versao_nova}.")
        finally:
            processo.terminate()
            processo.wait(timeout=30)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("anterior", type=Path)
    parser.add_argument("novo", type=Path)
    args = parser.parse_args()
    testar(args.anterior.resolve(strict=True), args.novo.resolve(strict=True))
