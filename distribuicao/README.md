# Publicar uma atualização para Windows

O instalador tem nome fixo para que o botão do README continue válido a cada versão. O repositório de distribuição é `valentelucass/siproquim-v2`. O canal está configurado no `application.properties`.

1. Ajuste a versão estável nos arquivos `frontend/package.json`, `backend/java/pom.xml` e `backend/java/src/main/resources/application.properties`. Use três números, por exemplo `2.0.1`.
2. No Windows x64 com PowerShell 7, JDK 25, Python 3.12 x64 e pnpm, execute os comandos abaixo pela raiz. O empacotador usa o jlink, o compilador do .NET Framework do Windows e a biblioteca MSI do Python 3.12. A compilação do frontend e o empacotamento do backend precedem a criação do MSI.
3. Faça commit, envie o código e a tag `v<Versão>` ao GitHub. Crie uma release em rascunho nessa tag. Anexe **Siproquim-Rodogarcia-x64.msi**, **atualizacao.json** e **SHA256SUMS.txt** gerados juntos em `release/v<Versão>/`. Publique como release estável depois de conferir os três arquivos. Use uma nova tag para qualquer correção.
4. Baixe o link do README sem autenticação e compare o SHA-256. Na estação de ensaio, confirme o aviso, a versão no rodapé e a reabertura de um lote.

```powershell
.\Backend.ps1 testar
.\Frontend.ps1 compilar
.\Frontend.ps1 testar
$versao = (Get-Content frontend/package.json -Raw | ConvertFrom-Json).version
$msi = "release/v$versao/Siproquim-Rodogarcia-x64.msi"
& backend/python/.venv/Scripts/python.exe -B distribuicao/empacotar.py
& backend/python/.venv/Scripts/python.exe -B distribuicao/testar_msi.py $msi
.\distribuicao\Assinar.ps1 -Instalador $msi -Versao $versao
```

## Assinatura e teste de atualização

O publicador assina a versão e o hash SHA-256 do pacote com RSA. A chave pública acompanha o backend. A chave privada fica no provedor CNG do usuário Windows que criou o canal. Para continuar publicando neste canal, use esse perfil e a mesma chave. A perda dessa chave exige distribuir uma versão de transição por instalação manual com uma nova âncora de confiança. O MSI atual não tem certificado de editor Windows (Authenticode).

O teste instala dois pacotes de uma família MSI temporária, abre a interface, importa um PDF com o Python distribuído e confere os dados pela API depois da troca de versão. Ele simula a versão anterior com o mesmo esquema de banco. A validação de migrações futuras deve incluir uma base criada pela release anterior.
