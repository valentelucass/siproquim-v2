"""Extrai os campos impressos no relatório de fretes. Não aplica correções fiscais."""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import pypdfium2 as pdfium


def label(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.upper())
                   if not unicodedata.combining(c)).strip()


def field(lines, expression):
    for line in lines:
        match = re.match(expression, line, re.IGNORECASE)
        if match:
            return line[match.end():].strip()
    return ""


def block(lines):
    """Delimita os papéis pelo cabeçalho, inclusive o 'CONTRANTE' da V1."""
    sections = {}
    current = None
    for line in lines:
        key = label(line)
        if key in {"EMITENTE", "DESTINATARIO", "CONTRATANTE", "CONTRANTE"}:
            current = {"EMITENTE": "origem", "DESTINATARIO": "destino"}.get(key, "contratante")
            sections[current] = []
        elif re.match(r"^(?:N[º°O.]*\s*)?CT-?E\s*:", key):
            current = "conhecimento"
            sections[current] = [line]
        elif current:
            sections[current].append(line)
    if not all(k in sections for k in ("origem", "destino", "contratante")):
        return None
    fields = {}
    for role in ("origem", "destino", "contratante"):
        part = sections[role]
        stop = next((i for i, x in enumerate(part) if ":" in x), len(part))
        fields[role + "Nome"] = " ".join(part[:stop]).strip()
        fields[role + "Doc"] = field(part, r"^(?:CNPJ/CPF|CPF/CNPJ|CPF|CNPJ)\s*:")
        city_line = next((x for x in part if "CIDADE:" in label(x)), "")
        fields[role + "Cidade"] = re.split(r"CIDADE:\s*", city_line, flags=re.I)[-1].strip()
        fields[role + "Endereco"] = field(part, r"^END(?:ERE[ÇC]O)?\.?\s*:")
    cte = sections.get("conhecimento", [])
    fields.update(cte=field(cte, r"^(?:N[º°o.]*\s*)?CT-?E\s*:"),
                  dataCte=field(cte, r"^DATA\s*:"),
                  recebedor=field(cte, r"^RECEBEDOR\s*:"),
                  dataEntrega=field(cte, r"^DATA\s+ENTREGA\s*:").split(" ")[0])
    return fields


def parse_lines(lines):
    lines = [x.strip() for x in lines if x.strip()]
    starts = [i for i, x in enumerate(lines) if label(x) == "DATA NF"]
    expected = max(len(starts), sum(label(x) == "EMITENTE" for x in lines),
                   sum(label(x) == "NF" for x in lines))
    rows = []
    for i, j in zip(starts, starts[1:] + [len(lines)]):
        segment = lines[i:j]
        if sum(label(x) == "EMITENTE" for x in segment) != 1:
            continue
        # Limita o bloco pelos rótulos para que dados ausentes não virem outro campo.
        try:
            nf_label = segment.index("NF")
            emit = next(k for k, x in enumerate(segment) if label(x) == "EMITENTE")
        except (ValueError, StopIteration):
            continue
        fields = block(segment[emit:])
        if fields is not None:
            fields["dataNf"] = " ".join(segment[1:nf_label])
            fields["nf"] = " ".join(segment[nf_label+1:emit])
            rows.append(fields)
    return rows, expected


def extract(path):
    rows = []
    with pdfium.PdfDocument(str(path)) as doc:
        for number, page in enumerate(doc, 1):
            try:
                text = page.get_textpage()
                try:
                    lines = text.get_text_range().splitlines()
                finally:
                    text.close()
            finally:
                page.close()
            parsed, count = parse_lines(lines)
            # O formato tabular da V1 pode ter uma ordem de texto diferente.
            if not parsed or len(parsed) != count:
                import pdfplumber
                with pdfplumber.open(path, pages=[number]) as fallback:
                    candidates = []
                    for table in fallback.pages[0].extract_tables():
                        flat = [line for row in table for cell in row if cell for line in cell.splitlines()]
                        found, expected = parse_lines(flat)
                        if len(found) != expected:
                            raise ValueError(f"Bloco incompleto na página {number}.")
                        candidates.extend(found)
                    if not candidates or len(candidates) < count:
                        raise ValueError(f"Confira o formato e a legibilidade da página {number}.")
                    parsed = candidates
            rows.extend({"pagina": number, "campos": r} for r in parsed)
        if not rows:
            raise ValueError("O PDF não contém operações legíveis.")
        return {"paginas": len(doc), "registros": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    args = parser.parse_args()
    try:
        json.dump(extract(args.pdf), sys.stdout, ensure_ascii=True)
    except Exception as exc:
        print(f"Falha de extração: {exc}", file=sys.stderr)
        sys.exit(2)
