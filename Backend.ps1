[CmdletBinding()]
param(
    [ValidateSet('iniciar','testar','empacotar')]
    [string]$Acao = 'iniciar'
)
$ErrorActionPreference = 'Stop'
$raizProjeto = $PSScriptRoot
$pastaJava = Join-Path $raizProjeto 'backend/java'
$pastaPython = Join-Path $raizProjeto 'backend/python'
$ambientePython = Join-Path $pastaPython '.venv'
if ($env:SIPROQUIM_VENV) { $ambientePython = $env:SIPROQUIM_VENV }
$empacotado = Join-Path $pastaJava 'target/siproquim-backend.jar'

function Conferir-Saida([string]$etapa) {
    if ($LASTEXITCODE -ne 0) { throw "Falha em $etapa (codigo $LASTEXITCODE)." }
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Instale o JDK 25 para executar o backend.' }
if (-not $env:SIPROQUIM_PYTHON) {
    $pythonLocal = Join-Path $ambientePython 'Scripts/python.exe'
    $uv = Get-Command uv -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath $pythonLocal)) {
        if ($uv) { & uv venv --python 3.12 $ambientePython }
        else { & python -m venv $ambientePython }
        Conferir-Saida 'criacao do ambiente Python'
    }
    $requisitos = Join-Path $pastaPython 'requirements.txt'
    if ($uv) { & uv pip install --python $pythonLocal -r $requisitos }
    else { & $pythonLocal -m pip install -r $requisitos }
    Conferir-Saida 'dependencias Python'
    $env:SIPROQUIM_PYTHON = $pythonLocal
}
if (-not $env:SIPROQUIM_EXTRATOR) { $env:SIPROQUIM_EXTRATOR = Join-Path $pastaPython 'extrair.py' }
if (-not $env:SIPROQUIM_DADOS) { $env:SIPROQUIM_DADOS = Join-Path $raizProjeto 'database' }

if (-not $env:SIPROQUIM_DOWNLOADS -and $env:OS -eq 'Windows_NT') {
    $chave = 'HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
    $downloadsWindows = [Microsoft.Win32.Registry]::GetValue($chave, '{374DE290-123F-4565-9164-39C4925E467B}', $null)
    if ($downloadsWindows) { $env:SIPROQUIM_DOWNLOADS = [Environment]::ExpandEnvironmentVariables($downloadsWindows) }
}

Push-Location $pastaJava
try {
    if ($Acao -eq 'testar' -or $Acao -eq 'empacotar') {
        & $env:SIPROQUIM_PYTHON -B -m unittest discover -s (Join-Path $pastaPython 'tests') -v
        Conferir-Saida 'testes Python'
        & .\mvnw.cmd --batch-mode package
        Conferir-Saida 'Maven'
        & $env:SIPROQUIM_PYTHON -B (Join-Path $raizProjeto 'backend/tests/verificar_reinicio.py')
        Conferir-Saida 'reinicio e substituicao do JAR'
        if ($env:SIPROQUIM_HISTORICO) {
            & $env:SIPROQUIM_PYTHON -B (Join-Path $raizProjeto 'backend/tests/verificar_historico.py') $env:SIPROQUIM_HISTORICO --isolado
            Conferir-Saida 'nove PDFs privados e TXTs historicos'
        }
    }
    else {
        if (-not (Test-Path -LiteralPath $empacotado)) {
            & .\mvnw.cmd --batch-mode package
            Conferir-Saida 'compilacao e testes'
        }
        $jarEmUso = Join-Path ([System.IO.Path]::GetTempPath()) ("siproquim-" + [guid]::NewGuid().ToString("N") + ".jar")
        Copy-Item -LiteralPath $empacotado -Destination $jarEmUso
        try {
            & java -jar $jarEmUso
            Conferir-Saida 'execucao do backend'
        } finally {
            if (Test-Path -LiteralPath $jarEmUso) { Remove-Item -LiteralPath $jarEmUso }
        }
    }
}
finally { Pop-Location }
