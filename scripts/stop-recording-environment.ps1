$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.recording-runtime'

function Stop-TrackedProcess {
  param(
    [string]$PidFile,
    [string]$ExpectedName
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "$ExpectedName was not tracked."
    return
  }

  $trackedPid = [int](Get-Content -Raw -LiteralPath $PidFile)
  $trackedProcess = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue

  if ($trackedProcess -and $trackedProcess.ProcessName -eq $ExpectedName) {
    Stop-Process -Id $trackedPid -Force
    $trackedProcess.WaitForExit()
    Write-Host "Stopped $ExpectedName (PID $trackedPid)."
  } elseif ($trackedProcess) {
    Write-Warning "PID $trackedPid belongs to $($trackedProcess.ProcessName); it was not stopped."
  } else {
    Write-Host "$ExpectedName was already stopped."
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-TrackedProcess -PidFile (Join-Path $runtimeDir 'server.pid') -ExpectedName 'node'
Stop-TrackedProcess -PidFile (Join-Path $runtimeDir 'cloudflared.pid') -ExpectedName 'cloudflared'

Write-Host 'Recording environment stopped.' -ForegroundColor Green
