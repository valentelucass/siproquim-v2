# Como usar o backend da V2

O backend recebe o PDF de fretes de uma filial e competência, mostra o que precisa de conferência e gera o TXT para importação no SIPROQUIM 2. Cada correção guarda o dado lido, a página do relatório e a justificativa. O processamento no portal e o protocolo são registrados pela operadora. [Fluxo de fechamento](fechamento-mensal.md)

## Iniciar e testar no Windows

Na raiz de `siproquim-v2`, use PowerShell com JDK 25 e Python 3.12 disponíveis. O iniciador pode usar `uv` para preparar o Python. A primeira instalação de dependências e a primeira compilação precisam de acesso aos respectivos repositórios. O ZIP inclui o JAR pronto.

```powershell
.\Backend.ps1 iniciar
```

A API atende em `http://127.0.0.1:8765/api`. Em outro PowerShell aberto na raiz, os comandos abaixo conferem a saúde do serviço e listam os lotes. O token é criado no primeiro uso.

```powershell
$api = 'http://127.0.0.1:8765/api'
$cabecalho = @{ 'X-Siproquim-Token' = (Get-Content -Raw .\database\api.token).Trim() }
Invoke-RestMethod "$api/saude"
Invoke-RestMethod "$api/lotes" -Headers $cabecalho
```

Para recompilar o JAR depois de alterar o Java e executar os testes, use `.\Backend.ps1 testar`. A ação `empacotar` também testa antes de entregar `backend/java/target/siproquim-backend.jar`. Com a exportação histórica disponível, defina `SIPROQUIM_HISTORICO` com o caminho da pasta que contém os anexos antes de executar o comando. [Resultados e reprodução](regressoes-backend.md)

## O que fica salvo

| Local | Conteúdo |
|---|---|
| `database/mapas.sqlite` | Banco SQLite na raiz. Guarda PDFs, operações, correções, sugestões com evidência, arquivos gerados e protocolos. |
| `database/api.token` | Credencial de acesso local à API. |
| `backend/java/src/main/resources/application.properties` | Porta, pasta do banco, origem da interface, configuração de extração e limites de upload. |
| `backend/java/src/main/resources/schema.sql` | Estrutura inicial das tabelas. |
| `backend/python/` | Extrator de PDF, versões das dependências e testes com amostra fictícia. |

Para uma cópia de segurança, encerre o serviço e copie a pasta `database/` inteira, inclusive eventuais arquivos auxiliares do SQLite. A pasta operacional fica fora do pacote de atualização. O teste de reinício comprova a preservação do lote ao trocar o JAR. O instalador com busca e assinatura de releases pelo padrão do Jujuba pertence à distribuição desktop.

## Fluxo pela API

Os caminhos abaixo começam em `/api`. Fora de `/saude`, envie o cabeçalho `X-Siproquim-Token`. Use `AAAA-MM` para competência e a última `lote.versao` devolvida pela API em cada alteração.

| Ação | Método e caminho | Entrada ou resultado |
|---|---|---|
| Listar filiais | `GET /filiais` | Cadastro de 19 filiais migradas da V1. Retorna sigla, empresa e CNPJ como texto, incluindo zeros iniciais. A origem está em `backend/java/src/main/resources/filiais.json`. |
| Importar fretes | `POST /lotes` | Formulário multipart com `arquivo` PDF, `cnpj` e `competencia`. A repetição do mesmo arquivo para a mesma filial e mês recupera o lote existente. |
| Declarar mês sem movimento | `POST /lotes/sem-movimento` | JSON com `cnpj`, `competencia` e `evidencia`. Exige declaração expressa. O sistema recusa PDF ilegível e impede marcar ausência se já há fretes cadastrados. |
| Conferir | `GET /lotes` e `GET /lotes/{id}` | Resumo dos lotes ou detalhe com operações, páginas, valores originais, ajustes, pendências por campo e decisões de classificação. |
| Consultar origem e alterações | `GET /lotes/{id}/pdf` e `GET /lotes/{id}/historico` | PDF de origem quando há fretes e sequência de eventos por versão. |
| Corrigir | `PATCH /lotes/{id}/operacoes` | JSON com `versao`, `operacao`, objeto `campos` e `evidencia`. Exemplo de campos: `{"recebedor":"NOME CONFORME COMPROVANTE"}`. A operação é identificada pelo seu ID no lote, pois a NF pode se repetir. |
| Ver o conteúdo que será exportado | `GET /lotes/{id}/previa-txt` | Aplica as regras de geração e devolve os bytes do TXT para conferência. Consultar mantém a versão e o estado do lote. |
| Exportar e baixar | `POST /lotes/{id}/exportar` e `GET /lotes/{id}/txt` | Envie `{"versao":N}` na exportação. Se houver pendências, o retorno 422 informa o que conferir. Após gravar, o Java relê e valida o TXT. |
| Salvar o TXT em Downloads | `POST /lotes/{id}/salvar-txt` | Grava na pasta de Downloads do usuário e devolve o nome e o caminho. Com `?versaoEnviada=N`, grava o TXT arquivado daquela versão. Se o nome já existir, recebe um sufixo numérico. |
| Informar processamento no portal | `POST /lotes/{id}/processamento` | JSON com `versao` e `evidencia`. Essa ação passa um lote exportado para `PROCESSADO`. |
| Registrar recibo | `POST /lotes/{id}/recibo` | JSON com `versao`, `protocolo`, `dataProtocolo` no formato `dd/mm/aaaa` e `evidencia`. A data informada no recibo fica no histórico daquela versão, junto ao protocolo. Para arquivar o PDF, envie esses campos mais `arquivo`, `cnpj` e `competencia` em multipart. Confira o conteúdo do recibo no portal. O backend compara a identificação informada, verifica o cabeçalho PDF e arquiva a versão. |
| Retificar e consultar versão anterior | `POST /lotes/{id}/reabrir` | Informe `versao` e `evidencia`. O lote volta para conferência. Use `GET /lotes/{id}/txt?versaoEnviada=N` ou `GET /lotes/{id}/recibo/N` para recuperar o TXT protocolado ou o PDF anexado na versão N. |
| Importar referências da V1 | `POST /memoria/importar` ou `POST /memoria/importar-v1` | Multipart com `arquivo` e `evidencia`. Aceita, respectivamente, um TXT processado confirmado pela equipe ou uma cópia do SQLite da V1. A migração preserva a origem legada e ignora vínculos em quarentena. |
| Consultar sugestões | `GET /memoria?filial=...&papel=...&nome=...` | Use `incluirLegado=true` para acrescentar sugestões da V1. A operadora confere o documento antes de aplicar uma correção. |

O caminho normal dos estados é `CONFERENCIA → EXPORTADO → PROCESSADO → PROTOCOLADO`. Uma correção em lote exportado exige nova exportação. Em caso de conflito de versão (409), recarregue o lote antes de reaplicar a alteração. O processamento e o recibo representam informações prestadas pela operação após usar o portal.

## Parâmetros de execução

| Variável | Uso |
|---|---|
| `SIPROQUIM_DADOS` | Substitui a pasta padrão `database/` da raiz. |
| `SIPROQUIM_DOWNLOADS` | Permite configurar uma pasta isolada para testes. Na inicialização normal do Windows, o iniciador usa a pasta Downloads do usuário, inclusive se redirecionada. |
| `SIPROQUIM_PORTA` e `SIPROQUIM_ORIGEM_UI` | Porta da API (8765) e origem admitida do frontend (`http://localhost:5173`). O servidor escuta na própria máquina. |
| `SIPROQUIM_VENV` | Ambiente virtual que o iniciador prepara. O padrão é `backend/python/.venv`. |
| `SIPROQUIM_PYTHON` e `SIPROQUIM_EXTRATOR` | Executável Python com as dependências instaladas e caminho do extrator. |
| `SIPROQUIM_TIMEOUT` | Prazo de extração em segundos. Padrão de 600 segundos. |
| `SIPROQUIM_TOKEN` | Credencial fornecida pela instalação em substituição ao token gerado em disco. |
| `SIPROQUIM_HISTORICO` | Pasta privada usada nos testes opcionais dos três TXTs e dos nove PDFs históricos. |

## Conferências que dependem de documento

A NF sozinha pode identificar várias prestações. O sistema preserva as ocorrências diferentes e permite indicar repetição ou vincular conhecimentos à mesma prestação. A dispensa do conhecimento requer a confirmação do trajeto municipal efetivo. Quando a NF foi emitida em outra competência, a operadora precisa conferir o mês da prestação. Identificações genéricas como “CARIMBO” pedem comprovante. [Regras de conferência](regras-de-conferencia.md)

Em transporte internacional, confirme o sentido, a parte estrangeira e o identificador do país na tabela da PF. O backend exige três dígitos e rejeita 000. A conferência de que o número pertence ao país correto é documental. O importador numérico mantém CNPJs com letras visíveis para revisão. [Leiaute e tabelas oficiais](leiaute-txt.md)
