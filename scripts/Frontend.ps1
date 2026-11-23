[CmdletBinding()]
param([ValidateSet('iniciar','testar','compilar')][string]$Acao='iniciar')
$ErrorActionPreference='Stop'
$raiz=Split-Path -Parent $PSScriptRoot
$frontend=Join-Path $raiz 'frontend'
$jar=Join-Path $raiz 'backend/java/target/siproquim-backend.jar'
$portaDados=if ($env:SIPROQUIM_PORTA) { [int]$env:SIPROQUIM_PORTA } else { 8765 }
function Conferir([string]$etapa) { if ($LASTEXITCODE -ne 0) { throw "Falha em $etapa." } }
function Saudavel([int]$porta) {
    try { return (Invoke-RestMethod "http://127.0.0.1:$porta/api/saude" -TimeoutSec 2).status -eq 'ok' }
    catch { return $false }
}
function Servico([int]$porta) {
    if (Saudavel $porta) { return }
    $antigaPorta=$env:SIPROQUIM_PORTA
    try {
        $env:SIPROQUIM_PORTA="$porta"
        $shell=(Get-Process -Id $PID).Path
        $processo=Start-Process -FilePath $shell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + (Join-Path $PSScriptRoot 'Backend.ps1') + '"'),'iniciar') -WorkingDirectory $raiz -WindowStyle Hidden -PassThru
        $limite=(Get-Date).AddMinutes(3)
        while ((Get-Date) -lt $limite) {
            if (Saudavel $porta) { return }
            if ($processo.HasExited) { throw "O backend encerrou antes de abrir a porta $porta." }
            Start-Sleep -Milliseconds 400
        }
        throw "O backend ainda não respondeu na porta $porta."
    } finally {
        $env:SIPROQUIM_PORTA=$antigaPorta
    }
}
Push-Location $frontend
try {
    if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
        & pnpm install --frozen-lockfile
        Conferir 'instalação do frontend'
    }
    if ($Acao -eq 'compilar') { & pnpm run build; Conferir 'compilação'; return }
    if (-not (Test-Path -LiteralPath $jar)) { & (Join-Path $PSScriptRoot 'Backend.ps1') empacotar; Conferir 'backend' }
    if ($Acao -eq 'testar') { & pnpm test; Conferir 'testes no navegador'; return }
    Servico $portaDados
    $url='http://127.0.0.1:5173/'
    try { $existente=Invoke-WebRequest $url -TimeoutSec 2 } catch { $existente=$null }
    if ($existente) {
        if ($existente.Content -notlike '*Conferência de fretes*') { throw 'A porta 5173 está em uso por outra aplicação.' }
        Write-Host "Prévia disponível em $url"
        return
    }
    & pnpm dev --open
    Conferir 'servidor da aplicação'
} finally { Pop-Location }
