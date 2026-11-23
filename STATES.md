# Estado do SIPROQUIM V2

Em 22/11/2026, a V2 oferece conferência de fretes no navegador. A operadora pode importar um PDF, corrigir as pendências com evidência, conferir o TXT e registrar o resultado obtido no portal. A versão relatada em uso operacional é a V1. [Abrir e testar a interface](docs/frontend.md)

| Parte | Situação |
|---|---|
| `backend/java/` | Java 25, Spring Boot 4.2.0 MVC e JDBC. Controllers recebem pedidos, serviços concentram regras e repositories persistem os dados. Configuração em `src/main/resources/application.properties`. |
| `backend/python/` | Python 3.12 com pypdfium2 e pdfplumber. Extrai os campos impressos e suas páginas para conferência pelo Java. |
| `database/` | SQLite na raiz da V2. Preserva lotes, documentos de origem, ajustes, comprovantes e versões protocoladas. O pacote de software contém o guia da pasta. |
| `frontend/` | React e TypeScript com componentes Meta Astryx, temas claro e escuro, prévia do PDF, seleção das 19 filiais da V1 e correções por campo. Arquivo e histórico dos lotes locais. O passo a passo destaca onde clicar na própria página. Usa o lote aberto quando há pendências editáveis e um exemplo em memória no primeiro acesso ou após a revisão. |
| Distribuição | MSI por usuário com Java e Python incluídos. Uma nova versão assinalada no rodapé abre um modal. O aplicativo verifica a assinatura do manifesto e o SHA-256 antes de iniciar o instalador. A troca de versão foi testada com um lote gravado. [Distribuição](distribuicao/README.md) |

## Evidência e pendências

A rodada de 23/11/2026 verificou a edição e a gravação dos 44 campos em lote de teste, os 21 atalhos de pendência de Castro nos dois temas e a escolha das 19 filiais pelo CNPJ. [Detalhes da validação no painel lateral](docs/validacao-acervo.md)

- **V2.** A validação cobre as quatro telas, a renderização dos nove relatórios reais e a recusa do documento alheio ao frete. O backend passou em 37 testes Java, 5 Python e no teste de troca do JAR. [Resultado por arquivo e regressões de interface](docs/validacao-acervo.md). O Java reproduziu os três TXTs de referência a partir dos campos históricos. A NF 66 de Curitiba e a NF 18103 têm proteções específicas. [Resultados e regressões](docs/regressoes-backend.md)
- **V1.** No checkout `4dfbca7`, passaram 29 testes com as amostras disponíveis. O pequeno relatório de duas notas de Agudos segue ausente. [Histórico detalhado](docs/casos-v1-e-testes.md)
- **Entrega oficial.** Falta comprovar um lote real produzido pela V2, importado e enviado no portal com recibo da filial e da competência. Os testes locais cobrem a geração, a conferência dos bytes e o arquivamento do protocolo informado pela operadora. [Fechamento mensal](docs/fechamento-mensal.md)
- **Conferência humana.** Identificação de recebedor, município efetivo, país do transporte e mês de prestação precisam de documento quando o relatório não traz informação suficiente. O código do país deve ser conferido na tabela da PF. [Regras de conferência](docs/regras-de-conferencia.md)

As regras, as fontes oficiais, a biblioteca offline e os projetos usados como referência estão no [índice da documentação](docs/README.md).
