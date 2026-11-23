CREATE TABLE IF NOT EXISTS lote (
 id TEXT PRIMARY KEY, cnpj TEXT NOT NULL, competencia TEXT NOT NULL, hash_pdf TEXT NOT NULL,
 nome TEXT NOT NULL, paginas INTEGER NOT NULL, operacoes TEXT NOT NULL, origem_pdf BLOB NOT NULL,
 versao INTEGER NOT NULL DEFAULT 1, estado TEXT NOT NULL DEFAULT 'CONFERENCIA',
 txt BLOB, protocolo TEXT, criado TEXT NOT NULL,
 UNIQUE(cnpj, competencia, hash_pdf)
);
CREATE TABLE IF NOT EXISTS historico (
 id INTEGER PRIMARY KEY, lote_id TEXT NOT NULL REFERENCES lote(id), versao INTEGER NOT NULL,
 evento TEXT NOT NULL, evidencia TEXT NOT NULL, alteracoes TEXT NOT NULL, instante TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memoria (
 filial TEXT NOT NULL, papel TEXT NOT NULL, nome TEXT NOT NULL, documento TEXT NOT NULL,
 fonte TEXT NOT NULL, PRIMARY KEY(filial,papel,nome,documento,fonte)
);
CREATE TABLE IF NOT EXISTS aprendizado (
 filial TEXT NOT NULL, hash TEXT NOT NULL, evidencia TEXT NOT NULL, PRIMARY KEY(filial,hash)
);
CREATE TABLE IF NOT EXISTS envio (
 lote_id TEXT NOT NULL REFERENCES lote(id), versao INTEGER NOT NULL, protocolo TEXT NOT NULL,
 txt BLOB NOT NULL, instante TEXT NOT NULL, PRIMARY KEY(lote_id,versao)
);
CREATE TABLE IF NOT EXISTS anexo_recibo (
 lote_id TEXT NOT NULL, versao INTEGER NOT NULL, pdf BLOB NOT NULL,
 PRIMARY KEY(lote_id,versao), FOREIGN KEY(lote_id,versao) REFERENCES envio(lote_id,versao)
);
