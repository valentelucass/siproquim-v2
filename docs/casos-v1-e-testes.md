# O que aconteceu na V1 e como testar a V2

O histórico foi reconstituído a partir do checkout da V1 e de exemplos operacionais privados. A tabela reúne os comportamentos que a V2 precisa preservar ou corrigir. [Código da V1](https://github.com/valentelucass/rpa-conversao-txt-siproquim/tree/4dfbca7db65c00464b015ce3e72a5612639b3ab7)

| Ocorrência | Resultado observado e regra de conferência |
|---|---|
| CT-e ausente em transporte municipal | O lote processado manteve as notas e retirou dois conhecimentos incompletos. Confira os locais efetivos de retirada e entrega antes de classificar a prestação. |
| Recebedor indicado como “CARIMBO” | O texto impresso e o nome da empresa usado pela V1 não identificam quem recebeu. A operadora precisa conferir o comprovante e registrar a fonte. |
| Mesmo número de NF em prestações distintas | Um conhecimento de outra prestação apareceu em competência diferente. Vincule a correção à prestação correspondente. |
| Competência e CPF no TXT | Após corrigir o mês, três linhas ainda falharam. A troca dos três zeros de preenchimento por espaços resolveu o problema. Preserve os onze dígitos do CPF. |
| Exportação internacional e documento nacional inválido no mesmo lote | A operação internacional exigiu TI/PI e país de destino. A outra nota dependia da confirmação do CPF/CNPJ. Corrija cada ocorrência sem deslocar as demais. |
| Documento inválido em duas fontes | O mesmo erro constava nos dois documentos. O campo permanece pendente até que exista evidência para o valor correto. |
| Atualização do software | O procedimento da V1 preservava a memória em AppData. Na V2, o ensaio reabre um lote após a atualização do programa. |

## Testes já executados na V1

- No checkout sem os PDFs privados, 24 testes passaram, três foram pulados e dois falharam por falta de arquivo. Em uma cópia isolada, com as amostras recuperadas da conversa, a suíte executou **29 testes, todos aprovados**, sem pular métodos. O teste de múltiplos PDFs percorre somente os arquivos disponíveis. O pequeno PDF esperado de Agudos, com duas notas, não foi localizado.
- Três pares PDF/TXT foram reprocessados com armazenamento local isolado. Os resultados foram 93 linhas exatas, 719 linhas exatas com uma correção documentada e uma diferença em 707 linhas. A saída de janeiro com 707 linhas teve sua divergência identificada até o campo.
- Controle negativo com a NF 405387, entre SP e SC. Remover sua linha CC ainda passou na validação local. Outro controle inseriu um modal inválido e foi rejeitado. O primeiro caso demonstra a necessidade de validar o trajeto antes da geração, com os dados que existem no PDF.
- Teste isolado da deduplicação da V1 com notas de dois emitentes e CT-es diferentes, mas o mesmo número. O algoritmo reteve só um registro. Preservar ambos quando pertencem a operações distintas.
- Os testes foram locais. O histórico registra processamento ou anexação no portal pela operadora. O envio final de cada competência pode ser confirmado mediante recibo. [Consulta oficial](fontes-pf/roteiros/21-consultar-protocolo-e-mapas.pdf)

## Critérios usados na implementação da V2

O [resultado da execução da V2](regressoes-backend.md) relaciona cada frente à cobertura atual. O ensaio com o PDF de Curitiba de fevereiro também revelou a divergência entre a NF 66 do relatório e a NF 413029 do TXT histórico.

| Cenário | Como comprovar |
|---|---|
| Reescrita dos fluxos nacionais e exportação | Repetir os pares históricos, comparar o arquivo inteiro e justificar cada divergência intencional. |
| Transporte municipal, intermunicipal, interestadual e trajeto desconhecido | Verificar os quatro cenários com e sem CT-e. Ter um controle que falhe se um frete com CC obrigatório for liberado incompleto. |
| Importação internacional, locais terceirizados e vários modais | Testar sentido da operação, PI de origem, código do país, LA, LR, LE e campos de modal. Completar com amostra operacional quando disponível. |
| Mesmo número de NF, vários itens, vários contratantes ou conhecimentos | Conferir o total antes e depois do agrupamento. Validar qual prestação cada documento comprova. |
| Dados inválidos, CNPJ alfanumérico, ausência de operações e PDF ilegível | Assegurar que os documentos originais e o motivo da pendência continuem visíveis. Condicionar exportação do CNPJ com letras à confirmação do leiaute aplicável. |
| Conferência e entrega | Exercitar corrigir, regerar, reabrir o TXT e associar recibo ao CNPJ e mês corretos. Registrar separadamente validação local, processamento externo e protocolo. |

Para reproduzir a suíte da V1, execute `python -m unittest discover -s tests -v` em uma cópia isolada do checkout, com dependências e PDFs privados nos caminhos previstos pelos testes. Use armazenamento local temporário. Registre o número de testes e os PDFs realmente utilizados. [Testes da V1 no commit estudado](https://github.com/valentelucass/rpa-conversao-txt-siproquim/tree/4dfbca7db65c00464b015ce3e72a5612639b3ab7/tests)
