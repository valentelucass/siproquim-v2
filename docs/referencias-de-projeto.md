# Referências de implementação

Busca no GitHub por `siproquim` e consulta aos repositórios em 22/11/2026. A base funcional adotada foi o conversor da própria Rodogarcia. A [biblioteca da PF](fontes-pf/README.md) e as [fontes oficiais](fontes-oficiais.md) fundamentam as regras de declaração.

| Referência | O que aproveitamos da consulta |
|---|---|
| [Conversor de Lucas](https://github.com/valentelucass/rpa-conversao-txt-siproquim) e [repositório da Rodogarcia](https://github.com/Dev-Rodogarcia/rpa-conversao-txt-siproquim) | Conversão de PDF para TXT de fretes, histórico de correções, empacotamento e testes. A referência de comportamento examinada está no commit `4dfbca7` do primeiro projeto. |
| [andersonls/siproquim2-mapas](https://github.com/andersonls/siproquim2-mapas) | Projeto PHP com exemplos, recursos e testes para mapas. O autor identifica a API como em desenvolvimento. |
| [apurcinodev/SIPROQUIM](https://github.com/apurcinodev/SIPROQUIM) | Aplicação Node.js de comparação de listas de produtos e movimentação em PDF ou planilha. Serve de referência para a revisão de divergências. |
| [gmedeirosnet/SIPROQUIM](https://github.com/gmedeirosnet/SIPROQUIM) | Sistema de estoque químico com rastreabilidade, PHP e PostgreSQL. Escopo de inventário por local e histórico de movimentos. |
| [aquinocom/pf.manuais.siproquim2](https://github.com/aquinocom/pf.manuais.siproquim2) | Projeto de documentação em Plone. O README contém texto de modelo. Para as regras, usamos as publicações identificadas da PF. |
| [Meta Astryx](https://github.com/meta/astryx) e [dashboards-etl](https://github.com/valentelucass/dashboards-etl) | Direção do frontend definida por Lucas. Usar componentes Astryx, composição do dashboard de referência e a marca sem a linha secundária. |
| [Jujuba](https://github.com/valentelucass/jujuba) | A configuração local desktop usa o atualizador Tauri 2, chave pública e manifesto `latest.json` das releases. A V2 segue o fluxo de verificação, assinatura e instalação com preservação dos dados locais. O canal da V2 usa seu próprio manifesto e sua própria chave RSA. |

A V2 usa Java 25, Spring Boot MVC e JDBC para regras e persistência em SQLite. Python com pypdfium2 e pdfplumber atende à leitura dos PDFs que deram origem às ocorrências históricas. As versões executadas estão no [guia do backend](backend.md) e nos manifestos do projeto.
