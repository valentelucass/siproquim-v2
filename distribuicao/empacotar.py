"""Monta o MSI x64 por usuário com o Windows Installer nativo e o Python 3.12."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from pathlib import Path
from msilib import CAB, PID_WORDCOUNT, add_data, init_database, schema, sequence

RAIZ = Path(__file__).resolve().parents[1]
NOME = "SIPROQUIM Rodogarcia"
FAMILIA = "{87E2ACF6-7506-4E0D-832F-B571F8C74FE9}"
VERSAO = json.loads((RAIZ / "frontend/package.json").read_text(encoding="utf-8"))["version"]
MSI = "Siproquim-Rodogarcia-x64.msi"


def guid(familia, nome):
    return "{" + str(uuid.uuid5(uuid.UUID(familia.strip("{}")), nome)).upper() + "}"


def arvore(z, origem, destino, excluir=()):
    for raiz, pastas, arquivos in os.walk(origem):
        pastas[:] = sorted(p for p in pastas if p not in excluir and p != "__pycache__")
        for nome in sorted(arquivos):
            if nome.endswith((".pyc", ".pyo")) or nome in excluir:
                continue
            caminho = Path(raiz) / nome
            z.write(caminho, str(Path(destino) / caminho.relative_to(origem)))


def montar_zip(pasta):
    java = pasta / "java"
    subprocess.run(["jlink", "--add-modules", "java.se,jdk.unsupported,jdk.crypto.ec,jdk.zipfs",
                    "--strip-debug", "--no-header-files", "--no-man-pages", "--output", str(java)], check=True)
    home = Path(sys.base_prefix)
    venv = Path(sys.prefix) / "Lib/site-packages"
    if not (venv / "pypdfium2_raw").is_dir():
        raise RuntimeError("Execute o empacotador com o Python 3.12 do backend.")
    with zipfile.ZipFile(pasta / "sistema.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=4) as z:
        arvore(z, java, "java")
        arvore(z, RAIZ / "frontend/dist", "web")
        z.write(RAIZ / "backend/java/target/siproquim-backend.jar", "sistema.jar")
        z.write(RAIZ / "backend/python/extrair.py", "extrair.py")
        for arquivo in [home / "python.exe", home / "LICENSE.txt", *home.glob("*.dll")]:
            z.write(arquivo, "python/" + arquivo.name)
        arvore(z, home / "DLLs", "python/DLLs")
        arvore(z, home / "Lib", "python/Lib", {"test", "tests", "site-packages", "idlelib", "ensurepip", "tkinter"})
        arvore(z, venv, "python/Lib/site-packages", {"pip", "setuptools", "wheel", "direct_url.json",
              "_virtualenv.pth", "_virtualenv.py", "tests", "test", ".lock"})


def compilar_atalho(pasta, versao):
    info = pasta / "Versao.cs"
    info.write_text('[assembly: System.Reflection.AssemblyVersion("' + versao + '.0")]', encoding="utf-8")
    csc = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    subprocess.run([str(csc), "/nologo", "/target:winexe", "/platform:x64", "/utf8output", "/codepage:65001",
                    "/r:System.Windows.Forms.dll", "/r:System.IO.Compression.FileSystem.dll",
                    "/out:" + str(pasta / "Siproquim.exe"), str(info), str(RAIZ / "distribuicao/Iniciar.cs")], check=True)


def montar_msi(pasta, saida, versao=VERSAO, familia=FAMILIA, nome=NOME):
    compilar_atalho(pasta, versao)
    db = init_database(str(saida), schema, nome, guid(familia, versao), versao, "Rodogarcia")
    info = db.GetSummaryInformation(1)
    info.SetProperty(PID_WORDCOUNT, 10)  # arquivos comprimidos, instalação por usuário
    info.Persist()
    add_data(db, "Property", [("UpgradeCode", familia), ("ARPNOMODIFY", "1"), ("LIMITUI", "1"),
                              ("SecureCustomProperties", "ANTERIOR;MAISNOVO")])
    add_data(db, "Upgrade", [(familia, None, versao, None, 0, None, "ANTERIOR"),
                             (familia, versao, None, None, 2, None, "MAISNOVO")])
    add_data(db, "LaunchCondition", [("NOT MAISNOVO", "Já existe uma versão mais recente instalada.")])
    # Remoção da versão anterior dentro da transação, com rollback em caso de falha.
    execucao = [(a, c, 1501 if a == "RemoveExistingProducts" else 700 if a == "LaunchConditions" else n)
                for a, c, n in sequence.InstallExecuteSequence]
    add_data(db, "InstallExecuteSequence", execucao)
    add_data(db, "AdminExecuteSequence", sequence.AdminExecuteSequence)
    add_data(db, "AdminUISequence", [(a, c, n) for a, c, n in sequence.AdminUISequence if n > 0])
    add_data(db, "InstallUISequence", [(a, c, 700 if a == "LaunchConditions" else n)
                                       for a, c, n in sequence.InstallUISequence if n > 0])
    add_data(db, "Directory", [("TARGETDIR", None, "SourceDir"), ("LocalAppDataFolder", "TARGETDIR", "."),
                               ("ProgramMenuFolder", "TARGETDIR", "."), ("DesktopFolder", "TARGETDIR", "."),
                               ("RODO", "LocalAppDataFolder", "Rodogarcia"),
                               ("INSTALLDIR", "RODO", "SIPROGUI|"+nome)])
    add_data(db, "Feature", [("Sistema", None, nome, None, 1, 1, "INSTALLDIR", 0)])
    add_data(db, "Component", [("Programa", guid(familia, "arquivos"), "INSTALLDIR", 260, None, "Chave")])
    add_data(db, "FeatureComponents", [("Sistema", "Programa")])
    add_data(db, "Registry", [("Chave", 1, "Software\\Rodogarcia\\" + nome, "Versao", versao, "Programa")])
    cab = CAB("programa.cab")
    for id_, arquivo in [("Iniciar", "Siproquim.exe"), ("Pacote", "sistema.zip")]:
        src = pasta / arquivo
        numero, _ = cab.append(str(src), arquivo, id_)
        add_data(db, "File", [(id_, "Programa", arquivo, src.stat().st_size, None, None, 512, numero)])
    for id_, onde in [("Inicio", "ProgramMenuFolder"), ("Mesa", "DesktopFolder")]:
        add_data(db, "Shortcut", [(id_, onde, "SIPROQ|"+nome, "Programa", "[#Iniciar]", None,
                                   nome, None, None, None, 1, "INSTALLDIR")])
    db.Commit()
    cab.commit(db)
    del db


if __name__ == "__main__":
    if sys.version_info[:2] != (3, 12) or sys.platform != "win32":
        sys.exit("Use Python 3.12 x64 no Windows.")
    import xml.etree.ElementTree as ET
    pom = ET.parse(RAIZ / "backend/java/pom.xml").getroot()
    config = (RAIZ / "backend/java/src/main/resources/application.properties").read_text(encoding="utf-8").splitlines()
    if pom.findtext("{*}version") != VERSAO or "siproquim.versao=" + VERSAO not in config:
        sys.exit("Alinhe as versões de package.json, pom.xml e application.properties.")
    destino = RAIZ / "release" / ("v" + VERSAO)
    destino.mkdir(exist_ok=True, parents=True)
    with tempfile.TemporaryDirectory(prefix="siproquim-build-", ignore_cleanup_errors=True) as temp:
        pasta = Path(temp)
        montar_zip(pasta)
        montar_msi(pasta, pasta / MSI)
        os.replace(pasta / MSI, destino / MSI)
    print(destino / MSI)
