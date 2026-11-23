# Publicar uma atualização para Windows

O instalador tem nome fixo para que o botão do README continue válido a cada versão. O repositório de distribuição é `valentelucass/siproquim-v2`. O canal está configurado no `application.properties`.

1. Ajuste a versão estável nos arquivos `frontend/package.json`, `backend/java/pom.xml` e `backend/java/src/main/resources/application.properties`. Use três números, por exemplo `2.0.1`.
2. No Windows x64 com PowerShell 7, JDK 25, Python 3.12 x64 e pnpm, execute os comandos abaixo pela raiz. O empacotador usa o jlink, o compilador do .NET Framework do Windows e a biblioteca MSI do Python 3.12. A compilação do frontend e o empacotamento do backend precedem a criação do MSI.
3. Faça commit, envie o código e a tag `v<Versão>` ao GitHub. Crie uma release em rascunho nessa tag. Anexe **Siproquim-Rodogarcia-x64.msi**, **atualizacao.json** e **SHA256SUMS.txt** gerados juntos em `release/v<Versão>/`. Publique como release estável depois de conferir os três arquivos. Use uma nova tag para qualquer correção.
4. Baixe o link do README sem autenticação e compare o SHA-256. Depois de publicar, rode `testar_canal.py` com o MSI da release anterior e o atual. Conclua a entrega quando a versão anterior reconhecer a publicação, verificar a assinatura e baixar o MSI esperado pelo canal público. Na estação de ensaio, confira também o aviso e o rodapé.

```powershell
.\scripts\Backend.ps1 testar
.\scripts\Frontend.ps1 compilar
.\scripts\Frontend.ps1 testar
$versao = (Get-Content frontend/package.json -Raw | ConvertFrom-Json).version
$msi = "release/v$versao/Siproquim-Rodogarcia-x64.msi"
& backend/python/.venv/Scripts/python.exe -B distribuicao/empacotar.py
& backend/python/.venv/Scripts/python.exe -B distribuicao/testar_abertura.py
& backend/python/.venv/Scripts/python.exe -B distribuicao/testar_msi.py $msi
.\distribuicao\Assinar.ps1 -Instalador $msi -Versao $versao
```

Depois de publicar, ajuste o caminho da versão anterior e confira o mesmo canal que o aplicativo consulta:

```powershell
$anterior = "release/v2.0.3/Siproquim-Rodogarcia-x64.msi"
& backend/python/.venv/Scripts/python.exe -B distribuicao/testar_canal.py $anterior $msi
```

O ensaio usa um perfil temporário e baixa o MSI pela API da instalação anterior. O GitHub pode levar alguns minutos para trocar o redirecionamento de `latest` após a publicação. O teste aguarda a propagação por até quatro minutos.

## Assinatura e teste de atualização

O publicador assina a versão e o hash SHA-256 do pacote com RSA. A chave pública acompanha o backend. A chave privada fica no provedor CNG do usuário Windows que criou o canal. Para continuar publicando neste canal, use esse perfil e a mesma chave. A perda dessa chave exige distribuir uma versão de transição por instalação manual com uma nova âncora de confiança. O MSI atual não tem certificado de editor Windows (Authenticode).

O teste instala dois pacotes de uma família MSI temporária, abre a interface, importa um PDF com o Python distribuído e compara o lote pela API depois da troca de versão. Acrescente `--anterior release/v2.0.0/Siproquim-Rodogarcia-x64.msi` ao comando de teste para criar esse lote com a aplicação e os runtimes da versão publicada. Quando o argumento é omitido, o ensaio simula a versão anterior com o esquema atual.

O desenho da folha dobrada fica em `siproquim.svg`. O Windows usa as resoluções de `siproquim.ico` no executável, no menu Iniciar, na área de trabalho e em Aplicativos instalados.

Na tabela `File` do MSI, o iniciador tem versão numérica e o ZIP acompanha a versão do iniciador. O teste confere os dois arquivos em disco e a versão do serviço aberto pelo atalho após cada instalação.

## Janela de desktop

Desde a 2.0.2, a instalação interativa chama o iniciador após concluir a transação. O atalho abre a aplicação WinForms com WebView2. A janela serve o React pelo serviço Java local e usa o perfil `%LOCALAPPDATA%\Rodogarcia\Siproquim\janela` para manter a aparência e as preferências entre versões. O SDK fixado é conferido pelo SHA-256 na compilação. O pacote inclui o bootstrapper assinado da Microsoft para estações que precisem instalar o runtime Evergreen. [Distribuição do WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

O ensaio de abertura verifica a instalação e a atualização interativas, o reparo, a remoção e a instalação silenciosa. O ensaio do MSI também usa o Playwright do frontend para interagir com a janela WebView2 instalada em um perfil de teste. A inspeção remota é habilitada apenas no processo do ensaio.

A janela abre o endereço local com a versão do executável. Isso evita reaproveitar o HTML de uma versão anterior que esteja no cache do WebView2. O ensaio atualiza a versão publicada, conserva o perfil e confere a posição do rodapé nas etapas Novo lote e Prévia do TXT.
