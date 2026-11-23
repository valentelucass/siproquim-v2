"""Exercita o inicializador Windows, atualização do JAR aberto e reabertura de SQLite."""
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]


def main():
    powershell = shutil.which("pwsh") or shutil.which("powershell")
    with tempfile.TemporaryDirectory(prefix="siproquim-reinicio-") as temp:
        base = Path(temp)
        target = base / "backend/java/target"
        target.mkdir(parents=True)
        jar = target / "siproquim-backend.jar"
        shutil.copy2(ROOT / "backend/java/target" / jar.name, jar)
        script = Path("scripts/Backend.ps1")
        (base / script.parent).mkdir()
        shutil.copy2(ROOT / script, base / script)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        token = secrets.token_urlsafe(32)
        env = dict(os.environ, SIPROQUIM_PYTHON=sys.executable, SIPROQUIM_TOKEN=token,
                   SIPROQUIM_EXTRATOR=str(ROOT / "backend/python/extrair.py"),
                   SIPROQUIM_DADOS=str(base / "database"), SIPROQUIM_PORTA=str(port), TEMP=temp, TMP=temp)

        def api(path, data=None):
            body = None if data is None else json.dumps(data).encode()
            req = Request(f"http://127.0.0.1:{port}/api"+path,body,
                          {"X-Siproquim-Token":token,"Content-Type":"application/json"})
            with urlopen(req, timeout=3) as r:
                return json.load(r)

        id_lote = None
        for vez in range(2):
            processo = subprocess.Popen([powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                                         str(base / script), "iniciar"],env=env,
                                        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                for _ in range(120):
                    if processo.poll() is not None:
                        raise RuntimeError("Inicializador encerrou antes de atender.")
                    try:
                        api("/saude")
                        break
                    except OSError:
                        time.sleep(.2)
                else:
                    raise RuntimeError("Backend não respondeu.")
                if vez == 0:
                    lote = api("/lotes/sem-movimento", {"cnpj":"11222333000181","competencia":"2026-10","evidencia":"teste"})
                    id_lote = lote["lote"]["id"]
                    # Renomear um artefato descartável reproduz a etapa do plugin Maven no Windows.
                    substituto = jar.with_suffix(".anterior")
                    jar.rename(substituto)
                    substituto.rename(jar)
                else:
                    assert api("/lotes/"+id_lote)["lote"]["versao"]==1
            finally:
                if processo.poll() is None:
                    subprocess.run(["taskkill","/PID",str(processo.pid),"/T","/F"],capture_output=True,check=False)
                processo.wait(timeout=15)
        print("Artefato substituível com o serviço ativo e lote preservado após reiniciar.")


if __name__=="__main__":
    main()
