# Leiaute do TXT de transporte

A PF indica o Manual Técnico v1.1, de 03/01/2025, para os envios a partir de 01/04/2025. Os intervalos abaixo incluem a primeira e a última posição, começando em 1. Para exemplos oficiais, consulte as páginas 1–2 e 12–14. [Vigência](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/manual-tecnico) · [Manual](fontes-pf/manual-tecnico-v1.1.pdf) · [Informativo de alterações](fontes-pf/informativo-tecnico-v1.1.pdf)

## Arquivo e cabeçalho

A PF especifica UTF-8, um registro por linha, posição fixa, texto em maiúsculas sem acentos, campos de texto completados com espaços à direita e números comuns com zeros à esquerda. Datas usam `dd/mm/aaaa`. A V1 grava sem BOM, verifica datas de calendário, preserva espaços significativos e reabre o arquivo gravado para validá-lo. O nome sugerido pela PF começa por M, seguido de ano, sigla do mês e CNPJ. A V1 trata o CPF de modo específico nos campos mistos. [Conferência de documentos](regras-de-conferencia.md)

**EM · identificação da empresa e do mapa, 31 posições.** Registro inicial único. Tipo 1–2, CNPJ do declarante 3–16, mês 17–19 (`JAN` a `DEZ`), ano 20–23 (a partir de 2010). As posições 24–31 recebem individualmente 0 ou 1 para comercialização nacional, comercialização internacional, produção, transformação, consumo, fabricação, transporte e armazenamento. Na rotina de transportadora, a posição 30 identifica a atividade de transporte.

## Transporte nacional

| Registro | Campos e posições |
|---|---|
| TN, 276 posições | Tipo 1–2. Documento do contratante 3–16 e nome 17–86. NF 87–96 e data de emissão 97–106. Documento da origem 107–120 e nome 121–190. Documento do destino 191–204 e nome 205–274. Local de retirada 275 e local de entrega 276. |
| CC, a partir de 103 posições | Tipo 1–2. Número do conhecimento 3–11, data do conhecimento 12–21, data de recebimento 22–31, responsável pelo recebimento 32–101. A partir de 102, modais em pares consecutivos. |
| LR / LE, 86 posições cada | Tipo 1–2. Documento da empresa terceirizada 3–16 e nome 17–86. LR para retirada e LE para entrega. |

- **CC.** A seção 3.1.9.1 exige o conhecimento para transporte intermunicipal ou interestadual. Para decidir, conferir os locais efetivos da prestação. O TXT de uma TN com locais próprios não informa os municípios e, sozinho, não permite verificar essa obrigação.
- **Modal.** RO representa rodoviário, AQ aquaviário, FE ferroviário e AE aéreo. O manual admite mais de um na mesma linha, concatenado, como ROAE. A V1 normalmente gera RO.
- **Local.** P significa próprio e A, armazenagem terceirizada. Retirada em A exige LR. Entrega em A exige LE. Quando ambas usam terceiros, as duas dependências se aplicam. As subseções pertencem à operação até a próxima seção principal.
- **Produtos.** No corpo do manual ainda há uma menção a demonstrativo geral no texto de TN. Para o lançamento de uma transportadora, a PF publicou orientação específica retirando a declaração dos produtos transportados. [Comunicado de transporte](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/novas-regras-para-transporte)

## Transporte internacional

| Registro | Campos e posições |
|---|---|
| TI, 109 posições | Tipo 1–2. Operação 3 (E exportação, I importação). Contratante 4 (O origem, D destino). NF 5–14 e data de emissão 15–24. Documento da empresa 25–38 e nome 39–108. Armazenamento 109 (P próprio ou A terceirizado). |
| PI, 145 posições | Tipo 1–2, nome da empresa estrangeira 3–72, identificador do país na tabela da PF 73–75 e endereço completo 76–145. |
| LA, 86 posições | Tipo 1–2, documento da empresa de armazenagem 3–16 e nome 17–86. |

Cada TI exige PI. Na importação, PI identifica a parte estrangeira de origem. Na exportação, PI identifica o destino estrangeiro. Se TI indicar armazenagem terceirizada, incluir LA. Confirmar país, endereço, sentido da operação e contratante na documentação do frete. O código 056 apareceu no lote de exportação para a Bélgica. Para outro país, consultar a tabela publicada pela PF. [Manual, itens 3.1.10 a 3.1.10.2](fontes-pf/manual-tecnico-v1.1.pdf#page=13) · [Tabelas de apoio da PF](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/arquivo-txt)
