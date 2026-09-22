param(
  [ValidateSet('start', 'stop')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $repositoryRoot 'work\postgres-data'
$logPath = Join-Path $dataDirectory 'server.log'
$postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
$postgresBin = Get-ChildItem -LiteralPath $postgresRoot -Directory |
  Sort-Object { [int]$_.Name } -Descending |
  Select-Object -First 1 |
  ForEach-Object { Join-Path $_.FullName 'bin' }

if (-not $postgresBin -or -not (Test-Path -LiteralPath (Join-Path $postgresBin 'pg_ctl.exe'))) {
  throw 'PostgreSQL is not installed. Install PostgreSQL or use npm run db:up with Docker Desktop.'
}

$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'

if ($Action -eq 'stop') {
  if (Test-Path -LiteralPath $dataDirectory) {
    & $pgCtl -D $dataDirectory stop
  }
  exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $dataDirectory)) {
  & (Join-Path $postgresBin 'initdb.exe') -D $dataDirectory -U nexus -A trust --encoding=UTF8 --no-locale
}

& $pgCtl -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl -D $dataDirectory -l $logPath -o '"-p 5433"' start
}

$databaseExists = & (Join-Path $postgresBin 'psql.exe') -h 127.0.0.1 -p 5433 -U nexus -d postgres -tAc "select 1 from pg_database where datname = 'nexus'"
if (-not $databaseExists) {
  & (Join-Path $postgresBin 'createdb.exe') -h 127.0.0.1 -p 5433 -U nexus nexus
}
