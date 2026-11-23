# Validação da conferência de fretes · 22/11/2026

As quatro telas foram exercitadas no Edge. Os nove relatórios reais da exportação abriram na V2. O teste percorreu todas as 1.875 páginas de frete e o sistema recusou a lista de presença. Na execução completa, passaram **33 verificações no Playwright, 37 testes Java e 5 testes Python**. O frontend também compilou para distribuição.

## PDFs da exportação

| Anexo | Páginas | Operações extraídas | Campos a conferir |
|---|---:|---:|---:|
| 00000097 · Consolidado | 1.187 | 2.023 | 3.536 |
| 00000113 · Castro | 9 | 21 | 21 |
| 00000114 · Curitiba | 13 | 25 | 22 |
| 00000115 · Novo Hamburgo | 14 | 38 | 46 |
| 00000116 · Osasco | 74 | 129 | 125 |
| 00000150 · Campinas | 234 | 365 | 373 |
| 00000220 · Curitiba, fevereiro | 23 | 46 | 46 |
| 00000343 · Campinas, março | 194 | 364 | 336 |
| 00000403 · Relatório de agosto | 127 | 161 | 315 |
| **Total nos nove relatórios** | **1.875** | **3.172** | **4.820** |

Os totais somam cada arquivo testado. O consolidado pode repetir operações de outros arquivos. Os testes de tela usaram CNPJs do cadastro da V1 em uma base de ensaio. Para os três arquivos com TXT de referência foi usada a filial daquele cabeçalho. Para os demais, a escolha do cadastro serviu apenas para exercitar o sistema. Uma operação pode ter várias pendências. O resultado mede o comportamento do aplicativo com esses dados.

- Cada PDF de frete entrou pelo formulário. Verifiquei que todas as páginas tinham vínculo com pelo menos uma operação. O navegador passou página por página, aguardou o desenho do documento e verificou a presença de conteúdo. O PDF baixado da tela tinha o mesmo SHA-256 do original em cada lote.
- O anexo 00000019 é uma lista de presença de duas páginas. A importação exibiu erro e a consulta ao arquivo confirmou que nenhum lote foi criado. Uma segunda leitura, com PDFium, conseguiu abrir as dez amostras e identificou uma única folha visualmente uniforme, a segunda página da lista de presença.
- Os três TXTs históricos foram comparados byte a byte a partir dos campos de referência, inclusive espaços e finais de linha. Os nove relatórios brutos apresentaram campos a conferir e a interface bloqueou a exportação. A NF 66 de Curitiba, a falta de CT-e na NF 18103 e o caso internacional de Campinas continuam cobertos.

## Telas e correções

| Onde | O que foi testado ou corrigido |
|---|---|
| Conferência | Correção com evidência, busca, abas, seleção de página e tema do documento. O visualizador passou a reconhecer rótulos e valores separados no PDF. Em Curitiba, confirmou o destaque do recebedor na página 2. Em Campinas, a NF 405387 aparece três vezes na página 62 com “CARIMBO”. Nesse caso a tela orienta a conferência visual. |
| Novo lote | A operadora escolhe entre as 19 filiais do cadastro da V1, com empresa, sigla e CNPJ. Testes cobrem o CNPJ gravado, zeros iniciais, seleção mantida após recarregar o navegador, cancelamento e nova tentativa quando o cadastro fica indisponível. |
| Fila de revisão | A fila montava todas as ocorrências de uma vez. Agora exibe 25 por página. A busca considera o lote inteiro. A regressão procura e abre a última de 180 ocorrências sintéticas. |
| Meus lotes | Testados busca por arquivo e competência, filtro por situação e reabertura do relatório. Corrigidos o nome acessível do filtro e a reimportação pela demonstração, que podia abrir outro lote mais recente. |
| Histórico | Um protocolo registrado sem PDF oferecia um botão de anexo que falhava. A lista agora consulta o anexo daquela versão. Testados recibos com e sem arquivo, rejeição de competência incorreta, download íntegro do PDF e recuperação após retificação. |
| Guia | Testados a abertura das dúvidas, os atalhos de navegação e o acesso às referências do manual e dos roteiros da PF. |
| Exportação | Em uma falha de download, a tela podia anunciar sucesso. O teste interrompe o primeiro download, verifica a mensagem de erro e baixa o TXT na segunda tentativa. O fluxo completo com dados fictícios também compara a prévia com os bytes gravados em Downloads. O arquivo de mesmo nome é preservado e o histórico usa a mesma pasta. O foco do campo de busca do seletor acompanha a moldura arredondada. |

Os ensaios usaram bases temporárias. Foi corrigida a limpeza dos bancos descartáveis após o fim do Playwright no Windows. As credenciais da PF, os PDFs privados e os dados operacionais ficam fora do pacote do sistema. A aceitação de um lote real enviado pela V2 ainda depende do recibo do portal. O relatório de duas notas de Agudos citado no histórico da V1 continua ausente da exportação disponível.

## Usabilidade no painel lateral · 23/11/2026

Na rodada final, passaram as **41 verificações do Playwright**, incluindo os dez PDFs do acervo. O backend passou nos 37 testes Java e cinco testes Python. A versão web compilou para distribuição.

- No lote de Castro, os 21 atalhos da prévia levaram ao campo e à página correspondentes nos temas claro e escuro. A pesquisa por “CPF/CNPJ” localizou as três notas com pendência de documento do destino. A pesquisa por “recebimento” localizou as 18 ocorrências. A validação desse lote foi somente de leitura.
- Em um lote de ensaio, cada um dos 44 campos do editor foi aberto, alterado e salvo com referência. O teste releu os valores gravados e comparou o conteúdo original de cada campo com o valor anterior à correção.
- As 19 opções do seletor de filial foram conferidas pelo CNPJ. As quatro telas foram medidas em larguras de 320 a 1.920 pixels. No painel de 615 × 440, o formulário rola com os botões de ação acessíveis.
- As dicas de filial, competência e comprovante explicam o dado esperado em português. Os testes exercitam a dica do mês por mouse e teclado, a recuperação de um arquivo com extensão PDF e conteúdo inválido e a correção de referências com mais de mil caracteres.

O roteiro foi conferido nas 13 etapas nos temas claro e escuro. O teste mede se a ponta da seta aponta para o controle, se o balão cabe na janela e se o destaque continua clicável. O cenário da fonte da correção cobre também a mudança de 1.440 × 900 para 390 × 360 pixels, a rolagem e o retorno ao tamanho inicial.

## Repetir na raiz do projeto

```powershell
$env:SIPROQUIM_HISTORICO = 'C:\acervo-privado\relatorios'
$env:SIPROQUIM_UI_ACERVO = $env:SIPROQUIM_HISTORICO
.\Backend.ps1 testar
.\Frontend.ps1 testar
.\Frontend.ps1 compilar
```

Após incluir o passo a passo na página e as dicas da conferência, passaram **46 verificações no Playwright**. Foram 36 verificações independentes dos anexos e uma por PDF do acervo. A rodada incluiu as 13 etapas por clique, a saída com Escape, a preservação da correção em digitação e os textos de ajuda por mouse e teclado nos dois temas. Também passaram 37 testes Java e 5 Python.

Referências consultadas no Guia. [Manual técnico da PF](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/manual-tecnico) e [Roteiros do módulo Mapas](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/arquivos-siproquim2/roteiros-e-apresentacoes/roteiros-mapas).
