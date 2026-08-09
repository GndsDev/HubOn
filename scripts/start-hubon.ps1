[CmdletBinding()]
param(
    [ValidateRange(30, 900)]
    [int]$EngineTimeoutSeconds = 240,

    [ValidateRange(30, 900)]
    [int]$HealthTimeoutSeconds = 240
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $installRoot "docker-compose.yml"
$environmentFile = Join-Path $installRoot ".env"
$logDirectory = Join-Path $installRoot "logs"
$logFile = Join-Path $logDirectory "startup.log"
$containerNames = @("hubon-postgres", "hubon-backend", "hubon-frontend")

function Write-HubonLog {
    param([string]$Message)

    try {
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 1MB) {
            Move-Item -LiteralPath $logFile -Destination "$logFile.previous" -Force
        }
        $line = "{0:u} {1}" -f [DateTime]::Now, $Message
        Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    } catch {
        # Startup must not fail only because local logging is unavailable.
    }
}

function Resolve-DockerCli {
    $command = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $bundledCli = Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe"
    if (Test-Path -LiteralPath $bundledCli) {
        return $bundledCli
    }

    throw "Docker CLI was not found. Install Docker Desktop before installing HubOn."
}

function Test-DockerEngine {
    try {
        & $script:dockerCli info --format "{{.ServerVersion}}" 1>$null 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Start-DockerEngine {
    if (Test-DockerEngine) {
        return
    }

    Write-HubonLog "Docker Engine is unavailable. Requesting Docker Desktop startup."
    $startRequested = $false
    try {
        & $script:dockerCli desktop start --detach --timeout 30 *> $null
        $startRequested = $LASTEXITCODE -eq 0
    } catch {
        $startRequested = $false
    }

    if (-not $startRequested) {
        $desktopExecutable = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        if (-not (Test-Path -LiteralPath $desktopExecutable)) {
            throw "Docker Desktop executable was not found."
        }
        Start-Process -FilePath $desktopExecutable -ArgumentList "-Autostart" -WindowStyle Hidden | Out-Null
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($EngineTimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Seconds 3
        if (Test-DockerEngine) {
            Write-HubonLog "Docker Engine is available."
            return
        }
    }

    throw "Docker Engine did not become available within $EngineTimeoutSeconds seconds."
}

function Start-HubonStack {
    $arguments = @(
        "compose",
        "--project-directory", $installRoot,
        "--env-file", $environmentFile,
        "-f", $composeFile,
        "up", "-d"
    )
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & $script:dockerCli @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        Write-HubonLog ("docker compose up failed: " + ($output -join " "))
        throw "HubOn containers could not be started."
    }
}

function Get-ContainerHealth {
    param([string]$ContainerName)

    $health = & $script:dockerCli inspect `
        --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" `
        $ContainerName 2>$null | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0 -or -not $health) {
        return "missing"
    }
    return $health.Trim()
}

function Wait-HubonHealth {
    $deadline = [DateTime]::UtcNow.AddSeconds($HealthTimeoutSeconds)
    $lastStatus = ""

    while ([DateTime]::UtcNow -lt $deadline) {
        $states = @{}
        foreach ($containerName in $containerNames) {
            $states[$containerName] = Get-ContainerHealth -ContainerName $containerName
        }
        $lastStatus = ($containerNames | ForEach-Object { "$_=$($states[$_])" }) -join ", "

        if (@($states.Values | Where-Object { $_ -ne "healthy" }).Count -eq 0) {
            Write-HubonLog "HubOn is healthy: $lastStatus"
            return
        }
        if (@($states.Values | Where-Object { $_ -in @("dead", "exited", "unhealthy") }).Count -gt 0) {
            throw "A HubOn container failed during startup: $lastStatus"
        }
        Start-Sleep -Seconds 3
    }

    throw "HubOn did not become healthy within $HealthTimeoutSeconds seconds: $lastStatus"
}

$mutex = New-Object System.Threading.Mutex($false, "Local\HubOnStartup")
$mutexAcquired = $false

try {
    $mutexAcquired = $mutex.WaitOne(0)
    if (-not $mutexAcquired) {
        Write-HubonLog "Another HubOn startup is already running."
        exit 0
    }

    if (-not (Test-Path -LiteralPath $composeFile)) {
        throw "docker-compose.yml was not found in $installRoot."
    }
    if (-not (Test-Path -LiteralPath $environmentFile)) {
        throw ".env was not found in $installRoot."
    }

    $script:dockerCli = Resolve-DockerCli
    Start-DockerEngine
    Start-HubonStack
    Wait-HubonHealth
    exit 0
} catch {
    Write-HubonLog ("Startup failed: " + $_.Exception.Message)
    exit 1
} finally {
    if ($mutexAcquired) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
