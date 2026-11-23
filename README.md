# SIPROQUIM · Rodogarcia

[![Baixar o instalador do SIPROQUIM para Windows 64 bits](docs/midia/baixar-windows.svg)](https://github.com/valentelucass/siproquim-v2/releases/latest/download/Siproquim-Rodogarcia-x64.msi)

### Do PDF ao TXT em 32 segundos

https://github.com/user-attachments/assets/423766f8-808a-47a1-babd-a5605ee65965

[Versões e notas de atualização](https://github.com/valentelucass/siproquim-v2/releases)

Aplicativo local da Rodogarcia para transformar relatórios de frete em TXT de transporte para o **SIPROQUIM 2 da Polícia Federal**. A operadora confere cada pendência no PDF, registra a correção e acompanha o histórico do lote até o protocolo.

## Instalar e começar

1. Baixe e abra o instalador acima. Java e Python acompanham o aplicativo.
2. Ao concluir a instalação, o **SIPROQUIM Rodogarcia** abre em uma janela própria do Windows. Nas próximas vezes, use o atalho da área de trabalho ou do menu Iniciar. O botão de sol ou lua altera a tela e a barra de título e guarda sua escolha para a próxima abertura.
3. Clique em **Novo lote**, escolha a filial pelo CNPJ, indique a competência e selecione o PDF.
4. Clique em uma pendência para abrir a página de origem. Confira o comprovante, escolha **Corrigir campo** e registre de onde veio a informação.
5. Abra **Prévia do TXT**. Quando o lote estiver pronto, clique em **Exportar TXT**. O arquivo fica em **Downloads**. Importe-o no portal da PF e registre o resultado e o protocolo no sistema.

Na primeira abertura da janela de desktop, o tema acompanha o Windows. Se você vinha da versão que abria no navegador, escolha o tema uma vez no aplicativo. O primeiro botão do cabeçalho abre um passo a passo. Se o Windows ainda precisar do componente Microsoft Edge WebView2, a primeira abertura usa internet para instalá-lo. [Guia da interface](docs/frontend.md) · [Fechamento mensal e recibo](docs/fechamento-mensal.md)

## Pedir ajuda

Se precisar de ajuda, clique no ícone de **Copiar informações para o desenvolvedor** no cabeçalho e cole o relatório na conversa com Lucas. Para cada frete, o texto identifica a nota e a página, explica as pendências e lista as verificações atendidas. Também informa a versão e a última falha técnica. Se o navegador pedir cópia manual, escolha **Selecionar texto** e pressione **Ctrl+C**.

## Atualizar

O sistema verifica as versões ao abrir e a cada 30 segundos enquanto a janela está visível. Ao retornar à janela após esse intervalo, ele consulta novamente. Quando chega uma versão nova, um aviso mostra o número instalado e o disponível. Salve a correção que estiver digitando e escolha **Atualizar agora**. O aplicativo verifica a assinatura e o conteúdo do pacote antes de abrir o instalador do Windows. Ao terminar a instalação iniciada pelo aplicativo, o sistema reabre. Se precisar, use o atalho do menu Iniciar.

**Agora não** fecha o aviso. A opção **Atualizar para…** continua ao lado de “Todos os direitos reservados” no rodapé. Ao clicar na versão instalada, você também pode consultar manualmente. A conferência local continua disponível sem internet.

A instalação guarda os lotes e documentos em `%LOCALAPPDATA%\Rodogarcia\Siproquim\database`. Feche o serviço antes de copiar a pasta completa para um backup. O ambiente de desenvolvimento usa a pasta `database/` do projeto. A primeira instalação da V2 começa com a base desse perfil. [Dados locais](database/README.md)

## Projeto e testes

| Parte | Tecnologias e função |
|---|---|
| Interface | React, TypeScript, Meta Astryx e PDF.js. Conferência lado a lado, temas claro e escuro, prévia do TXT e histórico. |
| Regras e banco | Java 25, Spring Boot MVC/JDBC e SQLite. Validação, gravação dos lotes, evidências e exportação. |
| Leitura de PDF | Python 3.12, PDFium e pdfplumber. Extração com referência à página do relatório. |
| Distribuição | Windows Installer x64, runtime Java e Python incluídos. Manifesto de atualização assinado e SHA-256 por release. |

Para desenvolvimento no Windows, instale JDK 25, Python 3.12, Node.js compatível com Vite 7 e pnpm. A partir da raiz, execute:

```powershell
.\scripts\Backend.ps1 testar
.\scripts\Frontend.ps1 compilar
.\scripts\Frontend.ps1 testar
.\scripts\Frontend.ps1 iniciar
```

Os testes de navegador usam o Microsoft Edge. A suíte funciona com PDFs fictícios. Quem tem acesso ao acervo histórico pode habilitar os testes adicionais conforme o guia. A validação local e a entrega no portal são etapas distintas. A confirmação de um envio real da V2 depende do recibo da PF.

[Documentação e fontes oficiais](docs/README.md) · [Estado e pendências](STATES.md) · [Validação](docs/validacao-acervo.md) · [Gerar e publicar uma versão](distribuicao/README.md)

© Rodogarcia. Todos os direitos reservados. Sistema criado por Lucas Andrade. [LinkedIn](https://www.linkedin.com/in/dev-lucasandrade/) · [Suporte por e-mail](mailto:lucasmac.dev@gmail.com)
