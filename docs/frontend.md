# Conferência de fretes no navegador

Em PowerShell, na raiz da V2, use `.\scripts\Frontend.ps1 iniciar` e abra [Conferência de fretes](http://127.0.0.1:5173/). No Windows, o ambiente testado usa Node 24, pnpm 11, JDK 25, Python 3.12 e Edge. A instalação inicial das dependências requer internet. As páginas, fontes e visualização do PDF são servidas pela máquina.

## Da importação ao recibo

1. O sistema abre os lotes locais guardados em `database/`. **Passo a passo**, a primeira ação do cabeçalho, mostra 13 etapas na própria tela. Um balão explica cada ação e uma seta aponta para o controle destacado. Usa o lote aberto quando há uma pendência editável. Clique no controle marcado em vermelho ou em **Avançar**. Use **Voltar** para repetir uma etapa e **Fechar** ou Escape para retomar o trabalho. No primeiro acesso ou com um lote já conferido, aparece um lote de exemplo em memória. Escolher o PDF, criar o lote, revisar o valor, indicar a fonte e salvar a correção têm etapas separadas. O roteiro avança por clique e preserva o lote e os filtros ao sair.
2. Em **Novo lote**, escolha a filial pelo nome ou sigla, informe a competência e selecione o relatório. As 19 opções reproduzem o cadastro da V1. A lista mostra a empresa e o CNPJ formatado para distinguir filiais com a mesma sigla. No primeiro uso a operadora escolhe a filial. Depois de criar ou reabrir um lote pelo formulário, a última filial confirmada fica selecionada no próximo uso deste navegador. [Cadastro da V1](https://github.com/valentelucass/rpa-conversao-txt-siproquim/blob/4dfbca7db65c00464b015ce3e72a5612639b3ab7/src/config/filiais.py) É possível abrir o PDF antes de importá-lo. Para declarar mês sem movimento, marque a opção e descreva a evidência consultada.
3. Na **Fila de revisão**, selecione uma pendência. A busca percorre o lote inteiro e o resultado é exibido em páginas de 25 ocorrências. A prévia abre a primeira página associada à operação e destaca o campo quando o texto permite identificá-lo de forma única. Em uma página ambígua, aparece uma orientação de conferência visual. A aba **Dados extraídos** compara valores lidos e atuais.
4. Em **Corrigir campo**, confira o documento, transcreva o valor e informe a fonte. Ao salvar, o Java valida o lote e a tela seleciona a próxima pendência. O histórico guarda o valor anterior, o novo e a evidência.
5. Abra **Prévia do TXT**. A prévia lista os campos pendentes ou mostra o conteúdo exato do arquivo. Ao exportar ou baixar pelo histórico, o sistema salva o TXT em Downloads e exibe o nome do arquivo. Um nome já utilizado recebe um sufixo, como `(1)`. Depois, importe e envie o mapa no portal da PF. Registre o processamento e o recibo na V2. A versão protocolada fica disponível no histórico após uma retificação. [Orientações para o fechamento](fechamento-mensal.md)

## Convenções visuais

O botão **TXT** no cabeçalho abre a prévia. Em uma janela estreita, **Ver página no PDF** leva da ocorrência ao documento e **Voltar à revisão** retorna à fila com a mesma seleção. No formulário de importação, o ícone de informação explica qual mês escolher e como identificar a filial. Passe o mouse ou navegue até ele com Tab. Escape fecha a dica. O editor mostra a orientação do campo selecionado e permite consultar o que registrar como fonte.

O cabeçalho concentra a navegação. Os ícones mostram o nome ao passar o mouse ou receber foco. Na conferência desktop, PDF e fila usam a altura disponível e têm rolagem independente. No tema escuro, **Cores originais** permite consultar a aparência do documento. Os modais podem ser fechados por Escape, pelo botão de fechar ou por clique no fundo.

As caixas multilinha usam o TextArea do Astryx. Começam compactas e podem ser ampliadas verticalmente até 160 px ou 25% da altura da janela, o que for menor. Textos maiores têm rolagem interna. O foco acompanha os cantos da moldura tanto com mouse como com teclado.

Componentes, temas e composição visual seguem as referências indicadas por Lucas. [Catálogo Meta Astryx](https://astryx.atmeta.com/components) · [Código do Astryx](https://github.com/meta/astryx) · [Dashboards ETL](https://github.com/valentelucass/dashboards-etl)

## Testes e regressões

Na raiz, execute `.\scripts\Frontend.ps1 testar` para o navegador e `.\scripts\Frontend.ps1 compilar` para TypeScript e a distribuição web. O Playwright inicia a aplicação e a API com um banco temporário. A suíte usa um PDF fictício e testa o fluxo da importação à retificação pela API local. A entrega efetiva ao portal exige recibo emitido pela PF.

| Sintoma ou fluxo | Como reproduzir a verificação |
|---|---|
| Botões de importação cortados na lateral do Codex | `usabilidade.spec.ts` abre o formulário em 615 × 440, verifica que Cancelar recebe o clique sem rolar e volta à conferência. Os campos rolam entre o título e as ações do formulário. |
| Escolha do mês, arquivo incorreto e limite da evidência | A mesma suíte abre e fecha a dica pelo mouse e pelo teclado nos dois temas, substitui um arquivo de outro formato por um PDF e corrige uma referência com mais de 1.000 caracteres. |
| Conferência dos 44 campos editáveis | Em uma cópia fictícia, o teste escolhe cada campo, lê a orientação associada, preenche texto ou seleção, registra a fonte e salva pela interface. Confere os ajustes retornados pelo Java, os valores originais e a leitura final no banco de teste. A validade fiscal de cada combinação é coberta separadamente pelos testes de regras. |
| Buscar por “CPF/CNPJ” ou “recebimento” ocultava pendências existentes | `validacao.spec.ts` consulta a fila pelo nome do campo, por destinatário sem acento e por NF com prefixo. `usabilidade.spec.ts` abre a página da ocorrência na janela estreita e volta à revisão. |
| Foco quadrado e caixa de evidência que crescia livremente | `caixas-de-texto.spec.ts` exercita mouse e teclado nos dois temas, força altura de 1.000 px e verifica a altura final, a rolagem e o texto integral na fila e no modal. |
| Mancha quadrada ao pressionar uma ocorrência e folha do PDF branca no escuro | `tema.spec.ts` verifica os cantos durante o clique e alterna entre a leitura escura e as cores originais. |
| Cabeçalho do modal encostado na borda e fechamento pelo fundo | `modais.spec.ts` mede o espaço, fecha os dois diálogos pelo fundo e verifica o retorno do foco. |
| A prévia do TXT misturava campos e notas, e a ação de exportar desaparecia quando havia pendências | A prévia conta as operações prontas, resume os campos por tipo e reúne cada ocorrência na sua operação com a página de origem. A ação **Exportar TXT** fica visível e é habilitada após a revisão e o carregamento da prévia. `conferencia.spec.ts` cobre o bloqueio e o acesso ao campo. Com o acervo local, `acervo.local.spec.ts` reproduz 21 campos pendentes em 18 das 21 operações e abre uma nota com dois campos para revisar. |
| Entrada operacional e roteiro | `historico.spec.ts` e `roteiro.spec.ts` verificam uma instalação vazia com a preferência antiga de demonstração. O roteiro mostra os controles na página, sem diálogo ou iframe. O teste cobre clique duplo, avanço manual, retorno, saída com Escape e restauração do foco. Nas 13 etapas, verifica se a seta aponta para o destaque e se o balão deixa o controle livre, inclusive após rolar ou redimensionar a janela. Nenhuma etapa importa, corrige ou exporta dados reais. |
| Ações da conferência sem explicação | `dicas.spec.ts` verifica o texto das dicas com mouse e teclado em Corrigir campo, Ver todos os campos, PDF original e Dados extraídos, nos dois temas. |
| Documento, correção e exportação | `conferencia.spec.ts` cobre localização no PDF, grade em três alturas, navegação, importação, correção com evidência e mês sem movimento. `entrega.spec.ts` compara os bytes baixados com a prévia e verifica histórico, protocolo de teste e reabertura. |

A validação inicial passou em 13 testes no Edge. A rodada ampliada cobre o seletor de filiais, as quatro telas, recuperação de download, lotes extensos, reimportação, anexos e PDFs reais. [Validação com o acervo de fretes](validacao-acervo.md). A comprovação de entrega por uma filial no portal continua pendente. [Resultados dos testes de regras e extração](regressoes-backend.md)

## Atualização no rodapé · 23/11/2026

A consulta roda ao abrir, ao retornar à janela após um minuto e a cada cinco minutos de uso. Uma nova versão abre o aviso quando a tela está disponível. “Agora não” mantém a atualização ao lado dos direitos reservados. A ausência de conexão permite continuar trabalhando. O link de Lucas Andrade usa um ícone de link externo e mantém a identificação acessível do LinkedIn.

Passaram 50 verificações no Edge, incluindo os dez PDFs do acervo e os avisos em claro e escuro. Há regressões para a publicação de uma atualização durante o uso, adiamento, falha de download e nova tentativa. O teste do roteiro sem lotes permite a consulta de versão e continua verificando que o passeio não grava dados. [Instalador e ensaio de troca de versão](../distribuicao/README.md)

### Suporte e atualização na versão 2.0.1

O ícone da prancheta no cabeçalho copia um relatório para colar na conversa de suporte. Ele indica a versão da interface e do serviço, a tela, a operação e o campo em revisão, a última falha e até 18 eventos da aba. Em erros de validação do serviço, inclui também a mensagem e o ponto do código. A cópia manual continua disponível quando o navegador bloqueia a área de transferência. A pessoa escolhe com quem compartilhar.

O relatório cobre todas as operações do lote, mesmo com busca ou paginação ativa. Cada uma traz NF, página, CT-e quando identificado, pendências com motivo, verificações atendidas pelas regras locais e nomes dos campos corrigidos. O resumo separa quantidade de operações, operações em revisão e quantidade de pendências. A verificação de documento mostra a quantidade de dígitos e a presença de letras. Textos livres de comprovantes e identificações pessoais ficam no banco local.

Na amostra de janeiro com nove páginas, a comparação do texto copiado com a resposta do serviço encontrou as 21 ocorrências nas operações corretas, inclusive as operações que acumulavam dois campos pendentes. Cada uma das 21 operações tinha o detalhamento das verificações atendidas.

Na janela de atualização, o ícone e o título identificam a situação, o número instalado ocupa uma linha própria e os botões ficam no rodapé. A regressão mede o recuo do conteúdo, a centralização do ícone e a distância até as ações nos temas claro e escuro.
