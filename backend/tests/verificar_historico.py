"""Ensaio local opcional sobre a exportação privada. Use um perfil de banco descartável."""
import argparse
import collections
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


def verificar(folder, url, token):
    def call(route, data=None, content_type=None):
        headers = {"X-Siproquim-Token": token}
        if content_type:
            headers["Content-Type"] = content_type
        request = Request(url.rstrip("/") + "/api" + route, data, headers)
        try:
            with urlopen(request, timeout=630) as result:
                return result.status, result.read()
        except HTTPError as err:
            return err.code, err.read()

    def arquivo(prefixo):
        item, = folder.glob(f"{prefixo:08}*")
        return item

    def multipart(prefixo, route):
        path = arquivo(prefixo)
        sep = uuid4().hex
        body = (f'--{sep}\r\nContent-Disposition: form-data; name="arquivo"; filename="amostra{path.suffix}"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n').encode()
        return call(route, body+path.read_bytes()+f"\r\n--{sep}--\r\n".encode(), "multipart/form-data; boundary="+sep)

    # Filial de cada comparação vem do próprio cabeçalho histórico.
    for entrada, referencia, esperado, periodo in [(220,270,46,"2026-02"),(150,154,354,"2026-01"),(343,373,359,"2026-03")]:
        final = arquivo(referencia).read_bytes()
        linhas = final.decode("utf-8").splitlines()
        filial = linhas[0][2:16]
        consulta = urlencode(dict(cnpj=filial, competencia=periodo))
        status, corpo = multipart(entrada, "/lotes?"+consulta)
        assert status == 200, (entrada,status,corpo[:180])
        res = json.loads(corpo)
        operacoes = res["lote"]["operacoes"]
        nfs = {o["original"]["nf"] for o in operacoes}
        historicas = {l[86:96].strip() for l in linhas if l.startswith("TN")}
        historicas.update(l[4:14].strip() for l in linhas if l.startswith("TI"))
        assert len(nfs) == esperado and len(historicas) == esperado
        if entrada == 220:
            # A referência histórica traz parte de um telefone no lugar desta NF curta.
            assert nfs - historicas == {"66"} and historicas - nfs == {"413029"}
            curta, = [o for o in operacoes if o["original"]["nf"] == "66"]
            assert curta["paginas"] == [5, 6] and curta["original"]["cte"] == "48390"
        else:
            assert nfs == historicas
        pendencias = res["pendencias"]
        status, conteudo = call(f'/lotes/{res["lote"]["id"]}/exportar',
                               json.dumps({"versao":res["lote"]["versao"]}).encode(),"application/json")
        if pendencias:
            assert status == 422 and json.loads(conteudo)["pendencias"]
        else:
            assert status == 200
            status, txt = call(f'/lotes/{res["lote"]["id"]}/txt')
            assert status == 200 and txt == final
        if entrada == 150:
            assert any(p["nf"]=="405387" and p["campo"]=="recebedor" for p in pendencias)
        if entrada == 343:
            assert any(p["nf"]=="45861" and p["campo"]=="destinoDoc" for p in pendencias)
            assert any(p["nf"]=="411574" and p["campo"]=="pais" for p in pendencias)
        status, _ = multipart(referencia, "/memoria/importar?evidencia=TXT-historico-processado")
        assert status == 200, (referencia,status)
        print(periodo,entrada,"notas",len(nfs),"prestações",len(operacoes),"campos a conferir",
              dict(collections.Counter(p["campo"] for p in pendencias)),flush=True)

    filial = arquivo(270).read_bytes()[2:16].decode()
    status, body = multipart(114, "/lotes?"+urlencode(dict(cnpj=filial,competencia="2026-01")))
    assert status == 200
    case = json.loads(body)
    assert any(p["nf"]=="18103" and p["campo"]=="cte" for p in case["pendencias"])
    print("Curitiba/janeiro: ocorrência interestadual 18103 em pendência.",flush=True)

    # Os relatórios restantes não têm TXT final confirmado no acervo. O CNPJ abaixo
    # é de teste e o banco deste ensaio é descartável. Verificamos leitura e revisão.
    for prefixo, periodo, paginas in [(97,"2026-01",1187),(113,"2026-01",9),(115,"2026-01",14),
                                    (116,"2026-01",74),(403,"2026-08",127)]:
        status, data = multipart(prefixo, "/lotes?"+urlencode(dict(cnpj="11222333000181",competencia=periodo)))
        assert status == 200, (prefixo,status)
        result = json.loads(data)
        assert result["lote"]["paginas"] == paginas
        vistos = {p for o in result["lote"]["operacoes"] for p in o["paginas"]}
        assert vistos == set(range(1, paginas+1))
        if prefixo == 403:
            assert any(p["nf"]=="27272" and p["campo"]=="destinoDoc" for p in result["pendencias"])
        print("Amostra",prefixo,"páginas com operações",len(vistos),"prestações extraídas",
              len(result["lote"]["operacoes"]),flush=True)


def ensaio_isolado(pasta):
    raiz = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory(prefix="siproquim-historico-") as tmp:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            porta = sock.getsockname()[1]
        url = f"http://127.0.0.1:{porta}"
        token = secrets.token_urlsafe(32)
        env = dict(os.environ, SIPROQUIM_DADOS=tmp, SIPROQUIM_PORTA=str(porta), SIPROQUIM_TOKEN=token,
                   SIPROQUIM_PYTHON=sys.executable, SIPROQUIM_EXTRATOR=str(raiz / "backend/python/extrair.py"))
        jar = raiz / "backend/java/target/siproquim-backend.jar"
        processo = subprocess.Popen(["java","-jar",str(jar)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(150):
                if processo.poll() is not None:
                    raise RuntimeError("O backend de ensaio encerrou.")
                try:
                    with urlopen(url+"/api/saude",timeout=2):
                        break
                except OSError:
                    time.sleep(.2)
            else:
                raise RuntimeError("Backend indisponível para o ensaio histórico.")
            verificar(pasta,url,token)
        finally:
            processo.terminate()
            try:
                processo.wait(timeout=10)
            except subprocess.TimeoutExpired:
                processo.kill()
                processo.wait()


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("pasta", type=Path)
    cli.add_argument("--url", default="http://127.0.0.1:8765")
    cli.add_argument("--isolado", action="store_true", help="Inicia o JAR com banco temporário e o encerra após o ensaio.")
    args = cli.parse_args()
    if args.isolado:
        ensaio_isolado(args.pasta)
    else:
        verificar(args.pasta, args.url, os.environ["SIPROQUIM_TOKEN"])
