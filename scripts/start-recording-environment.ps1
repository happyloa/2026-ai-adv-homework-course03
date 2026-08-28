$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
$cloudflaredPath = Join-Path $projectRoot '.local-tools\cloudflared.exe'
$runtimeDir = Join-Path $projectRoot '.recording-runtime'
$localUrl = 'http://127.0.0.1:3001'

function Stop-TrackedProcess {
  param(
    [string]$PidFile,
    [string]$ExpectedName
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    return
  }

  $trackedPid = [int](Get-Content -Raw -LiteralPath $PidFile)
  $trackedProcess = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
  if ($trackedProcess -and $trackedProcess.ProcessName -eq $ExpectedName) {
    Stop-Process -Id $trackedPid -Force
    $trackedProcess.WaitForExit()
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for $Url"
}

function Wait-ForPublicDns {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $hostName = ([System.Uri]$Url).DnsSafeHost
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $records = Resolve-DnsName `
        -Name $hostName `
        -Server '1.1.1.1' `
        -Type A `
        -DnsOnly `
        -ErrorAction Stop
      if ($records | Where-Object { $_.IPAddress }) {
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "Timed out waiting for public DNS record for $hostName"
}

if (-not (Test-Path -LiteralPath $envPath)) {
  throw 'Missing .env. Create it from .env.example and set JWT_SECRET first.'
}

if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
  throw 'Missing .local-tools\cloudflared.exe. Download the official Windows binary first.'
}

$nodeCommand = Get-Command node.exe -ErrorAction Stop
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$serverPidFile = Join-Path $runtimeDir 'server.pid'
$tunnelPidFile = Join-Path $runtimeDir 'cloudflared.pid'
$publicUrlFile = Join-Path $runtimeDir 'public-url.txt'

Write-Host ''
Write-Host 'Preparing the recording environment...' -ForegroundColor Cyan
Stop-TrackedProcess -PidFile $serverPidFile -ExpectedName 'node'
Stop-TrackedProcess -PidFile $tunnelPidFile -ExpectedName 'cloudflared'
Remove-Item -LiteralPath $publicUrlFile -Force -ErrorAction SilentlyContinue

try {
  $existingResponse = Invoke-WebRequest -Uri $localUrl -UseBasicParsing -TimeoutSec 2
  if ($existingResponse) {
    throw 'Port 3001 already has a running HTTP service. Stop it before continuing.'
  }
} catch {
  if ($_.Exception.Message -like 'Port 3001*') {
    throw
  }
}

$tunnelOutLog = Join-Path $runtimeDir 'cloudflared.out.log'
$tunnelErrLog = Join-Path $runtimeDir 'cloudflared.err.log'
$serverOutLog = Join-Path $runtimeDir 'server.out.log'
$serverErrLog = Join-Path $runtimeDir 'server.err.log'

$publicUrl = $null
$maxTunnelAttempts = 3

for ($attempt = 1; $attempt -le $maxTunnelAttempts; $attempt++) {
  Remove-Item -LiteralPath $tunnelOutLog,$tunnelErrLog -Force -ErrorAction SilentlyContinue
  Write-Host "Starting Cloudflare Quick Tunnel (attempt $attempt/$maxTunnelAttempts)..."

  $tunnelProcess = Start-Process `
    -FilePath $cloudflaredPath `
    -ArgumentList @('tunnel', '--no-autoupdate', '--url', $localUrl) `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $tunnelOutLog `
    -RedirectStandardError $tunnelErrLog `
    -WindowStyle Hidden `
    -PassThru

  $tunnelProcess.Id | Set-Content -LiteralPath $tunnelPidFile -Encoding ASCII

  $candidateUrl = $null
  $tunnelDeadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $tunnelDeadline -and -not $candidateUrl) {
    if ($tunnelProcess.HasExited) {
      break
    }

    $combinedLog = @(
      Get-Content -Raw -LiteralPath $tunnelOutLog -ErrorAction SilentlyContinue
      Get-Content -Raw -LiteralPath $tunnelErrLog -ErrorAction SilentlyContinue
    ) -join "`n"

    $match = [regex]::Match($combinedLog, 'https://[-a-z0-9]+\.trycloudflare\.com')
    if ($match.Success) {
      $candidateUrl = $match.Value
      break
    }

    Start-Sleep -Milliseconds 500
  }

  if (-not $candidateUrl) {
    Write-Warning 'cloudflared did not create a URL; retrying with a new tunnel.'
    Stop-TrackedProcess -PidFile $tunnelPidFile -ExpectedName 'cloudflared'
    continue
  }

  Write-Host "Candidate URL: $candidateUrl"
  Write-Host 'Waiting for Cloudflare to publish its DNS record...'
  try {
    Wait-ForPublicDns -Url $candidateUrl -TimeoutSeconds 30
    $publicUrl = $candidateUrl
    break
  } catch {
    Write-Warning 'Cloudflare returned a hostname without a DNS record; retrying with a new tunnel.'
    Stop-TrackedProcess -PidFile $tunnelPidFile -ExpectedName 'cloudflared'
  }
}

if (-not $publicUrl) {
  Stop-TrackedProcess -PidFile $tunnelPidFile -ExpectedName 'cloudflared'
  throw 'Cloudflare could not create a usable Quick Tunnel after 3 attempts. Run recording:start again.'
}

$envContent = Get-Content -Raw -LiteralPath $envPath
if ($envContent -match '(?m)^BASE_URL=.*$') {
  $envContent = [regex]::Replace($envContent, '(?m)^BASE_URL=.*$', "BASE_URL=$publicUrl")
} else {
  $envContent = $envContent.TrimEnd() + "`r`nBASE_URL=$publicUrl`r`n"
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $envContent, $utf8WithoutBom)
[System.IO.File]::WriteAllText($publicUrlFile, $publicUrl, $utf8WithoutBom)

Remove-Item -LiteralPath $serverOutLog,$serverErrLog -Force -ErrorAction SilentlyContinue
Write-Host 'Starting the local Node.js server...'

$serverProcess = Start-Process `
  -FilePath $nodeCommand.Source `
  -ArgumentList @('server.js') `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $serverOutLog `
  -RedirectStandardError $serverErrLog `
  -WindowStyle Hidden `
  -PassThru

$serverProcess.Id | Set-Content -LiteralPath $serverPidFile -Encoding ASCII

try {
  Wait-ForHttp -Url $localUrl -TimeoutSeconds 30
} catch {
  $serverDetails = Get-Content -Raw -LiteralPath $serverErrLog -ErrorAction SilentlyContinue
  Stop-TrackedProcess -PidFile $serverPidFile -ExpectedName 'node'
  Stop-TrackedProcess -PidFile $tunnelPidFile -ExpectedName 'cloudflared'
  throw "$($_.Exception.Message)`n$serverDetails"
}

Write-Host ''
Write-Host 'Recording environment is ready.' -ForegroundColor Green
Write-Host "Public URL : $publicUrl" -ForegroundColor Cyan
Write-Host "Local URL  : $localUrl"
Write-Host 'BASE_URL was updated in the ignored .env file.'
Write-Host 'Next step: npm run recording:check' -ForegroundColor Yellow
Write-Host 'When finished, run: npm run recording:stop'
