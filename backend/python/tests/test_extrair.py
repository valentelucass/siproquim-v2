import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from extrair import extract, parse_lines


class TestLeitura(unittest.TestCase):
    def test_pdf_abre_fecha_e_preserva_dados_e_pagina(self):
        rows = extract(HERE / "tests" / "frete-sintetico.pdf")
        self.assertEqual(rows["paginas"], 2)
        self.assertEqual([r["pagina"] for r in rows["registros"]], [1, 2])
        self.assertEqual(rows["registros"][0]["campos"]["recebedor"], "CARIMBO")
        self.assertEqual(rows["registros"][1]["campos"]["nf"], "77")

    def test_cabecalho_truncado_e_contabilizado(self):
        found, count = parse_lines(["DATA NF", "10/01/2026", "NF", "77"])
        self.assertEqual((found, count), ([], 1))

    def test_nf_curta_e_data_nunca_sao_substituidas_por_telefone_ou_data_do_cte(self):
        lines = ["DATA NF", "30/01/2026", "NF", "66", "EMITENTE", "ORIGEM", "FONE: 99990000111",
                 "DESTINATARIO", "DESTINO", "CONTRANTE", "ORIGEM", "Nº CT-e: 20", "DATA: 11/02/2026"]
        rows, _ = parse_lines(lines)
        self.assertEqual((rows[0]["nf"], rows[0]["dataNf"], rows[0]["dataCte"]), ("66", "30/01/2026", "11/02/2026"))

    def test_segundo_emitente_sem_cabecalho_nao_substitui_a_primeira_nota(self):
        lines = ["DATA NF", "02/02/2026", "NF", "21", "EMITENTE", "PRIMEIRO",
                 "DESTINATÁRIO", "DESTINO", "CONTRANTE", "CLIENTE",
                 "EMITENTE", "SEGUNDO", "DESTINATÁRIO", "OUTRO", "CONTRANTE", "CLIENTE"]
        rows, esperado = parse_lines(lines)
        self.assertEqual(esperado, 2)
        self.assertLess(len(rows), esperado)

    def test_fallback_de_tabela_quando_a_ordem_de_texto_estiver_incompleta(self):
        table = [["DATA NF\n02/02/2026", "NF\n21"], ["EMITENTE\nORIGEM", "DESTINATÁRIO\nDESTINO"],
                 ["CONTRANTE\nCLIENTE", "Nº CT-e: 999\nDATA: 02/02/2026"]]
        doc = MagicMock()
        page = MagicMock()
        page.get_textpage.return_value.get_text_range.return_value = "NF\n21"
        doc.__iter__.return_value = iter([page])
        doc.__len__.return_value = 1
        with patch("extrair.pdfium.PdfDocument") as pdf, patch("pdfplumber.open") as tables:
            pdf.return_value.__enter__.return_value = doc
            tables.return_value.__enter__.return_value.pages = [MagicMock()]
            tables.return_value.__enter__.return_value.pages[0].extract_tables.return_value = [table]
            dados = extract(Path("exemplo.pdf"))
        self.assertEqual(dados["registros"][0]["campos"]["cte"], "999")
