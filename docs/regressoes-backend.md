# Regressões e resultados do backend

Em 22/11/2026, a execução completa no Windows passou em **37 testes Java e 5 testes Python**, sem falhas ou testes pulados. O mesmo comando também iniciou o sistema em banco temporário, verificou a troca do JAR e reprocessou nove PDFs históricos pela API.

## O que os testes demonstraram

| Verificação | Resultado observado |
|---|---|
| Importação real | Nove PDFs de frete, totalizando 1.875 páginas. O maior tinha 1.187 páginas. O ensaio confere a presença de operações na extensão dos relatórios e campos específicos dos lotes de referência. |
| Curitiba, fevereiro | 46 notas, 46 prestações. No PDF, o CT-e 48390 acompanha a NF **66** nas páginas 5 e 6. O histórico gravou **413029**, sequência que também aparece no telefone. O teste exige a NF do campo correto e as duas páginas. |
| Campinas, janeiro | 354 números de nota, 365 ocorrências distintas de prestação. A NF 405387 fica em conferência porque o campo do recebedor contém “CARIMBO”. |
| Campinas, março | 359 números de nota, 364 ocorrências distintas. O teste verifica o documento pendente da NF 45861 e o caso internacional da NF 411574. |
| Curitiba, janeiro | A NF 18103 aparece em trajeto interestadual. O backend aponta a falta do CT-e e impede a exportação incompleta. |
| Escrita do TXT | A partir dos campos dos três TXTs históricos, o Java reproduziu byte por byte as referências de 93, 707 e 719 linhas, incluindo espaços e quebras de linha. O ensaio com os PDFs brutos mede a extração e o bloqueio por pendência separadamente. |
| API e persistência | Importar, corrigir com evidência, gerar, baixar, registrar processamento, arquivar protocolo, anexar recibo e reabrir. Duas correções concorrentes preservam a decisão gravada primeiro. |
| Atualização local | O Windows permitiu substituir o artefato de distribuição com o serviço ativo. Após reiniciar, o lote de teste e as informações gravadas no SQLite continuavam disponíveis. |

## Falhas que ganharam proteção

| Falha observada | Proteção incorporada |
|---|---|
| O leitor Python falhava ao abrir o texto de uma página. Um bloco incompleto também podia confundir a segunda nota da página com a primeira. | Testes do extrator exercitam o PDF de duas páginas, contatos próximos da NF e bloco incompleto. O leitor libera os recursos e confere a quantidade esperada de blocos antes de aceitar a extração. |
| O Spring interpretava o caminho relativo do extrator como recurso do servidor. | Teste pela API inicializa com o caminho relativo padrão e importa PDF. |
| O navegador recebia 401 na consulta prévia de permissão da interface. | Teste HTTP envia a requisição prévia com os cabeçalhos reais do frontend e verifica a origem autorizada. Os pedidos de dados continuam exigindo token. |
| A geração podia perder o segundo conhecimento da mesma prestação. | Teste exige um TN seguido dos dois CC distintos e recusa vínculos incompatíveis. |
| Dois municípios desconhecidos podiam ser considerados iguais. Em retirada terceirizada, o município fiscal podia dispensar indevidamente o CC. | Testes exercitam municípios desconhecidos e troca entre locais próprios e terceiros. A conferência usa os locais efetivos. |
| O protocolo podia ser arquivado sem a data impressa no recibo. O histórico só tinha o instante do registro local. | Um teste pela API exige a data do recibo, recusa uma data impossível e recupera a data oficial após reabrir o lote. |
| A conferência precisava mostrar o TXT antes de marcar o lote como exportado. | O teste HTTP compara os bytes da prévia e do download, verifica a versão e o estado da consulta e exercita a validação do mês sem movimento. |
| O histórico exibia o comando para baixar recibo inclusive quando o protocolo foi registrado sem anexo. | A consulta verifica a existência do PDF pela chave do lote e da versão. Testes HTTP e de tela cobrem os dois cenários, incluindo dados já gravados e o acesso após retificação. |
| O formulário exigia digitar o CNPJ mesmo para filiais cadastradas na V1. | A API fornece os 19 pares do cadastro original e os testes verificam filiais com sigla repetida e CNPJ iniciado por zero. A seleção é conferida no envio HTTP, no lote e na prévia do TXT. |
| O destino do TXT dependia do navegador. | Um teste HTTP grava o arquivo na pasta Downloads do perfil de teste, compara os bytes com o arquivo exportado e preserva um homônimo preexistente. A suíte do navegador também testa o download da versão arquivada. |
| O Windows mantinha o JAR de distribuição bloqueado enquanto o backend estava aberto. | O iniciador executa uma cópia temporária. Um teste inicia o serviço, substitui o artefato no caminho de distribuição, reinicia e consulta o lote. |

## Como repetir

1. Em PowerShell, na raiz do projeto, execute `.\Backend.ps1 testar`. As amostras fictícias acompanham o código e os bancos de teste são temporários.
2. Para repetir a execução integral, defina antes `$env:SIPROQUIM_HISTORICO = 'C:\caminho\para\anexos'`. A pasta deve conter os nove PDFs e os três TXTs originais da exportação privada. Sem essa variável, o Maven pula os três casos que leem TXTs privados e o iniciador omite o ensaio externo dos nove PDFs.
3. A cada novo defeito, acrescente um teste que reproduza o erro pela entrada afetada. Execute-o antes de corrigir, confira que falhou pelo motivo esperado, aplique a correção e repita o teste e a suíte. Registre aqui o sintoma, a origem da evidência e a proteção criada. Use dados fictícios para material versionado.

A amostra de duas notas de Agudos continua indisponível. Importação internacional, vários modais e locais terceirizados têm casos automatizados construídos para essas regras. A aceitação de um lote real da V2 no portal e o respectivo recibo seguem pendentes de comprovação. [Histórico da V1](casos-v1-e-testes.md) · [Manual técnico da PF](fontes-pf/manual-tecnico-v1.1.pdf)

## Distribuição para Windows

O ensaio do MSI verifica os atalhos no menu Iniciar e na área de trabalho, inclusive quando o Windows redireciona a área de trabalho para o OneDrive. Compara o conteúdo extraído com o JAR e a interface compilados, importa um PDF de seis páginas e reabre o mesmo lote depois de atualizar. A suíte Java cobre comparação de versões, assinatura alterada e pacote adulterado. [Repetir o ensaio](../distribuicao/README.md)
