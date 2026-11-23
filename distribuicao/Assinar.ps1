# Requer PowerShell 7 no Windows. A chave privada permanece no repositório CNG do usuário.
param([string]$Instalador, [string]$Versao, [switch]$Inicializar)
$ErrorActionPreference='Stop'
$nome='Rodogarcia.SiproquimV2.Release.1'
$publica=Join-Path $PSScriptRoot '../backend/java/src/main/resources/atualizacao.pub'
if (-not [Security.Cryptography.CngKey]::Exists($nome)) {
    if (-not $Inicializar -or (Test-Path $publica)) { throw 'Chave privada de distribuição ausente neste usuário do Windows.' }
    $criacao=[Security.Cryptography.CngKeyCreationParameters]::new()
    $criacao.Parameters.Add([Security.Cryptography.CngProperty]::new('Length',[BitConverter]::GetBytes(3072),0))
    $chave=[Security.Cryptography.CngKey]::Create([Security.Cryptography.CngAlgorithm]::Rsa,$nome,$criacao)
} else { $chave=[Security.Cryptography.CngKey]::Open($nome) }
$rsa=[Security.Cryptography.RSACng]::new($chave)
try {
    $ancora=[Convert]::ToBase64String($rsa.ExportSubjectPublicKeyInfo())
    if ($Inicializar -and !(Test-Path $publica)) { [IO.File]::WriteAllText($publica,$ancora) }
    if ((Get-Content -Raw $publica).Trim() -ne $ancora) { throw 'A chave local difere da chave pública do aplicativo.' }
    if ($Inicializar) { return }
    if ($Versao -notmatch '^\d+\.\d+\.\d+$') { throw 'Versão inválida.' }
    $hash=(Get-FileHash -LiteralPath $Instalador -Algorithm SHA256).Hash.ToLowerInvariant()
    $bytes=[Text.Encoding]::UTF8.GetBytes("$Versao`n$hash`n")
    $assinatura=$rsa.SignData($bytes,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $pasta=Split-Path (Resolve-Path $Instalador)
    $manifesto=@{versao=$Versao;sha256=$hash;assinatura=[Convert]::ToBase64String($assinatura)}
    [IO.File]::WriteAllText((Join-Path $pasta 'atualizacao.json'), ($manifesto | ConvertTo-Json))
    [IO.File]::WriteAllText((Join-Path $pasta 'SHA256SUMS.txt'), "$hash  $(Split-Path $Instalador -Leaf)`n")
} finally { $rsa.Dispose(); $chave.Dispose() }
