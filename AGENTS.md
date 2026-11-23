# Orientações do projeto siproquim-v2

Leia [STATES.md](STATES.md) para saber em que etapa o projeto está e [docs/README.md](docs/README.md) para localizar regras, histórico dos erros e cobertura dos testes.

## Desenvolvimento

- Implemente a V2 em MVC com camadas de serviço e persistência. O React é a View. Em Java, organize controllers, services, models e repositories conforme [arquitetura](docs/arquitetura.md). Mantenha a regra do frete testável sem abrir uma tela nem acessar o banco.

- Preserve o fluxo da V1 que já funcionou em produção. Quando uma regra da PF divergir do comportamento histórico, documente a diferença e teste o caso na entrada normal do conversor.
- Use o Manual Técnico vigente para posições, tamanhos e dependências. Para a obrigação declaratória da transportadora, confira também a portaria e os comunicados da PF. Indique a fonte e a data nas alterações de regra.
- Use Java 25 com Spring Boot MVC, Spring JDBC e as configurações em `backend/java/src/main/resources/application.properties`. Guarde o banco da aplicação em `database/`, na raiz. Em `backend/python/`, mantenha a extração do texto e das tabelas com página de origem. A interface em `frontend/` segue React, TypeScript e Meta Astryx com referência no dashboards-etl.
- Preserve o documento de origem, a filial, a competência, a NF, a página do relatório e o vínculo entre cada correção e sua evidência. Mantenha PDFs privados, conversas e dados pessoais fora de arquivos de teste versionados.
- Teste cada mudança de regra ou de conversão. Inclua um caso que deve passar e outro que deve apontar o erro. Reprocesse as referências pertinentes e compare os TXTs com seus espaços. Informe amostras ausentes, falhas, testes pulados e se houve teste real no portal.
- Para cada bug, crie primeiro um teste de regressão que falhe pelo motivo relatado, corrija o problema, execute o teste novamente e rode a suíte pela raiz com `.\Backend.ps1 testar`. Registre sintoma, evidência, cobertura e resultado no [histórico de regressões](docs/regressoes-backend.md). Teste a entrada pública afetada e preserve a amostra quando puder ser compartilhada.
- Para bugs da interface, reproduza a interação no Playwright, corrija e rode `.\Frontend.ps1 testar` e `.\Frontend.ps1 compilar`. Use o componente oficial do Astryx e verifique mouse, teclado e os dois temas. As regressões de interface estão no [guia do frontend](docs/frontend.md).
- Mantenha separados os estados de validação local, processamento pelo portal e entrega com protocolo. Confirme o significado de cada novo estado com a documentação oficial.
- Use o Jujuba como referência para atualizar o software e teste a preservação da memória da aplicação durante a atualização.

<!-- local-ai-tools:start -->
## Ambiente local obrigatório: AI Memory e Graphify

Leia e aplique também `C:/Users/lucas/OneDrive/Documentos/projetos/AGENTS.md`. AI Memory e Graphify estão instalados nativamente; AI Memory não usa Docker. Consulte ambos antes de tarefas técnicas, conforme os limites da ferramenta. Use a identidade de `.ai-memory.toml`, preserve o trabalho existente e atualize o grafo proporcional aos fontes alterados. Ao concluir, registre a continuidade e decisões pertinentes na memória. Não invente histórico, consultas ou validações.
<!-- local-ai-tools:end -->
