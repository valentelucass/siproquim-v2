# Arquitetura MVC da V2

A interface React com TypeScript é a View. A aplicação Spring Boot já expõe os controllers e concentra no Java o modelo, as regras de transporte e a persistência. O Python lê os relatórios antigos. A pasta do banco fica na raiz para permitir a substituição dos arquivos de software. [Guia do backend](backend.md)

| Local | Responsabilidade | Exemplo |
|---|---|---|
| `frontend/` | Interface em React e TypeScript com Meta Astryx, seguindo a composição do dashboards-etl. | Mostrar nota, página, campo pendente e evidência de correção. |
| Java · `controller/` | Receber as ações HTTP e devolver o resultado ou o erro. | Receber correção da operação e sua versão. |
| Java · `model/` | Representar lote, competência, operações, pendências e correções. | Guardar campos originais, ajustes e páginas que pertencem à mesma operação. |
| Java · `service/` | Extrair pelo Python, aplicar regras, gerar o TXT, validar o arquivo relido e registrar o fechamento. | Exigir conhecimento de carga em trajeto interestadual e manter o histórico da decisão. |
| Java · `repository/` | Gravar e consultar no SQLite por transação. | Preservar a versão de um TXT protocolado e o recibo anexado depois de reabrir o lote. |
| Java · `config/` | Configurar acesso HTTP local e conexão com o banco. | Validar o token ao consultar dados e permitir a origem configurada da interface. |
| `backend/python/` | Extrair o texto por rótulo e, quando necessário, recuperar a estrutura de tabela com pdfplumber. Devolve JSON ao Java. | Recuperar “CARIMBO” como impresso e identificar a página para a operadora. |
| `database/` | Guardar o SQLite e a credencial local fora do artefato de software. | Trocar o JAR e recuperar o mesmo lote no reinício. |

Os pacotes Java ficam em `backend/java/src/main/java/br/com/rodogarcia/siproquim/`. Propriedades e SQL ficam em `backend/java/src/main/resources/`. O perfil de teste está em `backend/java/src/test/resources/` e usa banco temporário.

## Caminho de uma nota

1. O controller recebe PDF, CNPJ da filial e competência. O serviço identifica o arquivo pelo conteúdo.
2. O Python retorna os campos impressos e suas páginas. O Java preserva as ocorrências e sinaliza incompatibilidades e informações ausentes.
3. Uma correção chega com ID da operação, versão do lote e evidência. O repository grava os valores anteriores e novos. Uma tentativa com versão antiga recebe conflito.
4. O Java aplica novamente as regras antes de gerar o TXT. Depois de gravar, compara os bytes e valida a estrutura relida.
5. A operadora importa e envia no portal. Na V2, registra o processamento e, após o envio, o protocolo. Quando há retificação, o TXT protocolado continua recuperável pela versão.

A cobertura de regras, banco, API e substituição do artefato está nos [testes de regressão](regressoes-backend.md).
