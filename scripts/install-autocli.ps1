$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskDestination = Join-Path $taskRoot '.tools/autocli/0.3.8'
New-Item -ItemType Directory -Force -Path $taskDestination | Out-Null
$taskArchive = Join-Path $taskDestination 'autocli.zip'
Invoke-WebRequest -Uri 'https://github.com/nashsu/AutoCLI/releases/download/v0.3.8/autocli-x86_64-pc-windows-msvc.zip' -OutFile $taskArchive
$taskExpected = 'cd439179091b28a0c9e373d69e93d767e2dc1e0e61dfc6c0f45607c588e7c1d1'
if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLower() -ne $taskExpected) { throw 'AutoCLI release checksum mismatch' }
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskDestination -Force
$taskBinary = Join-Path $taskDestination 'autocli.exe'
if (!(Test-Path -LiteralPath $taskBinary)) { throw 'Expected autocli.exe in release archive' }
@{ archiveSha256=$taskExpected; binarySha256=(Get-FileHash -LiteralPath $taskBinary -Algorithm SHA256).Hash.ToLower(); version='0.3.8' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskDestination 'verified.json') -Encoding ascii
Write-Output 'Verified AutoCLI v0.3.8 installed in project .tools directory.'
