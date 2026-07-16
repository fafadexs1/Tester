[CmdletBinding()]
param(
    [string]$Repository = 'fafadexs/nexusflow',
    [string]$Tag,
    [string]$FallbackTag = '2.93',
    [string]$Platform = 'linux/amd64',
    [switch]$TagLatest,
    [switch]$Login,
    [switch]$NoCache,
    [switch]$SkipRemoteLookup,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Get-NextNumericTag {
    param([Parameter(Mandatory = $true)][string]$CurrentTag)

    if ($CurrentTag -notmatch '^\d+(?:\.\d+)+$') {
        throw "A tag base '$CurrentTag' nao e numerica. Use algo como 2.93."
    }

    $parts = @($CurrentTag.Split('.') | ForEach-Object { [int]$_ })
    $parts[$parts.Count - 1]++
    return ($parts -join '.')
}

function Get-LatestDockerHubNumericTag {
    param([Parameter(Mandatory = $true)][string]$ImageRepository)

    $url = "https://hub.docker.com/v2/repositories/$ImageRepository/tags?page_size=100&ordering=last_updated"
    $response = Invoke-RestMethod -Method Get -Uri $url -Headers @{ 'User-Agent' = 'nexusflow-release-script' }
    $numericTags = @($response.results.name | Where-Object { $_ -match '^\d+(?:\.\d+)+$' })
    if ($numericTags.Count -eq 0) {
        throw 'O Docker Hub nao retornou nenhuma tag numerica.'
    }

    return ($numericTags | Sort-Object { [version]$_ } -Descending | Select-Object -First 1)
}

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    Write-Host ("docker " + ($Arguments -join ' ')) -ForegroundColor DarkGray
    if ($DryRun) { return }

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "O Docker encerrou com o codigo $LASTEXITCODE."
    }
}

if ($Repository -notmatch '^[a-z0-9._-]+/[a-z0-9._-]+$') {
    throw "Repositorio Docker invalido: '$Repository'."
}

if (-not $Tag) {
    $baseTag = $FallbackTag
    if (-not $SkipRemoteLookup) {
        try {
            $baseTag = Get-LatestDockerHubNumericTag -ImageRepository $Repository
            Write-Host "Ultima tag numerica encontrada no Docker Hub: $baseTag" -ForegroundColor Cyan
        }
        catch {
            Write-Warning "Nao foi possivel consultar as tags do Docker Hub: $($_.Exception.Message)"
            Write-Warning "Usando a tag base local $FallbackTag."
        }
    }
    $Tag = Get-NextNumericTag -CurrentTag $baseTag
}

if ($Tag -notmatch '^[A-Za-z0-9_.-]+$') {
    throw "Tag Docker invalida: '$Tag'."
}

$versionedImage = "${Repository}:${Tag}"
$dockerfile = Join-Path $projectRoot 'Dockerfile'
if (-not (Test-Path -LiteralPath $dockerfile)) {
    throw "Dockerfile nao encontrado em $projectRoot."
}

Write-Host ''
Write-Host 'Release Docker do NexusFlow' -ForegroundColor Green
Write-Host "Imagem:     $versionedImage"
Write-Host "Plataforma: $Platform"
Write-Host "Contexto:   $projectRoot"
if ($TagLatest) { Write-Host "Tag extra:   ${Repository}:latest" }
if ($DryRun) { Write-Host 'Modo:        simulacao (nenhum build ou push sera executado)' -ForegroundColor Yellow }
Write-Host ''

if (-not $DryRun) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker nao encontrado. Instale ou inicie o Docker Desktop.'
    }
    Invoke-Docker -Arguments @('buildx', 'version')
}

if ($Login) {
    Invoke-Docker -Arguments @('login')
}

$buildArguments = @(
    'buildx', 'build',
    '--platform', $Platform,
    '--file', $dockerfile,
    '--tag', $versionedImage
)
if ($TagLatest) {
    $buildArguments += @('--tag', "${Repository}:latest")
}
if ($NoCache) {
    $buildArguments += '--no-cache'
}
$buildArguments += @('--push', $projectRoot)

Invoke-Docker -Arguments $buildArguments

Write-Host ''
if ($DryRun) {
    Write-Host "Simulacao concluida. A proxima imagem seria $versionedImage." -ForegroundColor Yellow
} else {
    Write-Host "Imagem publicada com sucesso: $versionedImage" -ForegroundColor Green
    Write-Host "https://hub.docker.com/r/$Repository/tags" -ForegroundColor Cyan
}
