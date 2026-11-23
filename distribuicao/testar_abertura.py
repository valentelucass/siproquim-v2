"""Exercita a ação pós-instalação com a UI básica e uma família MSI isolada."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid
from empacotar import MSI, guid, montar_msi


def testar():
    familia = "{" + str(uuid.uuid4()).upper() + "}"
    nome = "Siproquim Teste Abertura " + familia[1:9]
    compilador = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    with tempfile.TemporaryDirectory(prefix="siproquim-abertura-") as temp:
        base = Path(temp)
        instalado = base / "instalado"
        registro = instalado / "aberturas"
        fonte = base / "Sonda.cs"
        produtos = []

        def executar(*args, ui="/qn"):
            subprocess.run(["msiexec.exe", *map(str, args), ui, "/norestart"], check=True, timeout=90)

        def conferir(esperado):
            limite = time.monotonic() + 6
            while time.monotonic() < limite and not registro.exists():
                time.sleep(.1)
            time.sleep(.5)
            linhas = registro.read_text().splitlines() if registro.exists() else []
            assert linhas == esperado, f"Aberturas esperadas {esperado}, observadas {linhas}"

        try:
            for numero in (1, 2):
                versao = f"1.0.{numero}"
                pasta = base / versao
                pasta.mkdir()
                fonte.write_text(f'[assembly:System.Reflection.AssemblyVersion("{versao}.0")]\n'
                                 'class Sonda { static void Main() { System.IO.File.AppendAllText('
                                 'System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory,"aberturas"), '
                                 f'"{versao}\\n"); }} }}')
                subprocess.run([str(compilador), "/nologo", "/target:winexe", "/out:"+str(pasta/"Siproquim.exe"), str(fonte)], check=True)
                (pasta/"sistema.zip").write_bytes(b"sonda")
                pacote = pasta/MSI
                montar_msi(pasta, pacote, versao, familia, nome)
                produtos.append(guid(familia, versao))
                executar("/i", pacote, "INSTALLDIR="+str(instalado), ui="/qb!")
                conferir(["1.0.1", "1.0.2"][:numero])
            executar("/f", produtos[-1], ui="/qb!")
            executar("/x", produtos[-1], ui="/qb!")
            conferir(["1.0.1", "1.0.2"])
            executar("/i", pacote, "INSTALLDIR="+str(instalado))
            conferir(["1.0.1", "1.0.2"])
        finally:
            for produto in reversed(produtos):
                subprocess.run(["msiexec.exe", "/x", produto, "/qn", "/norestart"], timeout=90)
        print("MSI abriu uma vez ao instalar e ao atualizar. Reparo, remoção e modo silencioso conferidos.")


if __name__ == "__main__":
    testar()
