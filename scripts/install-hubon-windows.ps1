[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$InstallPath = "C:\HubOn",

    [string]$EnvironmentFile,

    [switch]$SkipDesktopShortcut,

    [ValidateRange(30, 900)]
    [int]$EngineTimeoutSeconds = 240,

    [ValidateRange(30, 900)]
    [int]$HealthTimeoutSeconds = 240
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "HubOn"
$sourceRoot = Split-Path -Parent $PSScriptRoot
$InstallPath = [IO.Path]::GetFullPath($InstallPath)

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this installer from an administrator PowerShell session."
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

    throw "Docker CLI was not found. Install Docker Desktop first."
}

function Test-DockerEngine {
    try {
        & $script:dockerCli info --format "{{.ServerVersion}}" 1>$null 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-DockerEngine {
    if (Test-DockerEngine) {
        return
    }

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
            return
        }
    }
    throw "Docker Engine did not become available within $EngineTimeoutSeconds seconds."
}

function Copy-HubonFiles {
    if ($sourceRoot.TrimEnd("\") -eq $InstallPath.TrimEnd("\")) {
        return
    }
    if ($InstallPath.StartsWith($sourceRoot.TrimEnd("\") + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "The installation path cannot be inside the source repository."
    }

    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    $arguments = @(
        $sourceRoot,
        $InstallPath,
        "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:2", "/W:2",
        "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
        "/XD", ".git", "node_modules", "target", "dist", ".angular", ".idea", ".vscode",
        "coverage", "logs", "playwright-report", "test-results",
        "/XF", ".env", "*.log", "*.tmp", "*.dump", "*.bak"
    )
    & robocopy.exe @arguments | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "HubOn files could not be copied to $InstallPath. Robocopy exit code: $LASTEXITCODE"
    }
}

function Initialize-EnvironmentFile {
    $targetEnvironment = Join-Path $InstallPath ".env"
    if (Test-Path -LiteralPath $targetEnvironment) {
        return $targetEnvironment
    }

    $candidate = $null
    if ($EnvironmentFile) {
        $candidate = [IO.Path]::GetFullPath($EnvironmentFile)
    } else {
        $sourceEnvironment = Join-Path $sourceRoot ".env"
        if (Test-Path -LiteralPath $sourceEnvironment) {
            $candidate = $sourceEnvironment
        }
    }

    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) {
        $example = Join-Path $InstallPath ".env.example"
        if (Test-Path -LiteralPath $example) {
            Copy-Item -LiteralPath $example -Destination $targetEnvironment
        }
        throw "Configure $targetEnvironment with real installation secrets and run the installer again."
    }

    Copy-Item -LiteralPath $candidate -Destination $targetEnvironment
    return $targetEnvironment
}

function Read-EnvironmentValues {
    param([string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*([^#][^=]*)=(.*)$") {
            $values[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $values
}

function Assert-EnvironmentFile {
    param([string]$Path)

    $values = Read-EnvironmentValues -Path $Path
    $required = @(
        "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "JWT_SECRET",
        "HUBON_SEED_OWNER_PASSWORD", "HUBON_SEED_ADMIN_PASSWORD"
    )
    foreach ($name in $required) {
        if (-not $values.ContainsKey($name) -or [String]::IsNullOrWhiteSpace($values[$name])) {
            throw "Required setting $name is missing from $Path."
        }
        if ($values[$name] -match "(?i)change-me") {
            throw "Replace the placeholder for $name in $Path before installing."
        }
    }
    if ($values["POSTGRES_DB"] -ne "hubon_db") {
        throw "Client installations must use POSTGRES_DB=hubon_db."
    }
    if ($values.ContainsKey("COMPOSE_PROJECT_NAME") -and $values["COMPOSE_PROJECT_NAME"] -ne "hubon") {
        throw "COMPOSE_PROJECT_NAME must be hubon so the persistent volume is reused."
    }
    if ($values["JWT_SECRET"].Length -lt 32) {
        throw "JWT_SECRET must contain at least 32 characters."
    }
    if (($values.Values -join "`n") -match "(?i)hubon_test") {
        throw "hubon_test is forbidden in a client installation environment."
    }
}

function Invoke-Compose {
    param([string[]]$Arguments)

    $composeFile = Join-Path $InstallPath "docker-compose.yml"
    $environment = Join-Path $InstallPath ".env"
    $dockerArguments = @(
        "compose", "--project-directory", $InstallPath,
        "--env-file", $environment, "-f", $composeFile
    ) + $Arguments
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $script:dockerCli @dockerArguments
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed."
    }
}

function Register-HubonTask {
    $startScript = Join-Path $InstallPath "scripts\start-hubon.ps1"
    $windowsPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $taskArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $startScript
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name

    $action = New-ScheduledTaskAction `
        -Execute $windowsPowerShell `
        -Argument $taskArguments `
        -WorkingDirectory $InstallPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
    $task = New-ScheduledTask `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Starts Docker Desktop and ensures the HubOn stack is healthy at logon."

    Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
    if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
        throw "The HubOn scheduled task could not be validated."
    }
}

function New-HubonShortcut {
    if ($SkipDesktopShortcut) {
        return
    }

    $desktop = [Environment]::GetFolderPath("Desktop")
    if ([String]::IsNullOrWhiteSpace($desktop)) {
        return
    }

    $iconPath = Join-Path $InstallPath "assets\hubon.ico"
    if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
        throw "HubOn shortcut icon was not found at $iconPath."
    }

    $chromeCandidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")
    )
    $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    if (-not [String]::IsNullOrWhiteSpace($programFilesX86)) {
        $chromeCandidates += Join-Path $programFilesX86 "Google\Chrome\Application\chrome.exe"
    }
    $chromeExecutable = $chromeCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1

    $shortcutPath = Join-Path $desktop "HubOn.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    if ($chromeExecutable) {
        $shortcut.TargetPath = $chromeExecutable
        $shortcut.Arguments = "--app=http://localhost:4200"
    } else {
        $shortcut.TargetPath = Join-Path $env:SystemRoot "System32\rundll32.exe"
        $shortcut.Arguments = 'url.dll,FileProtocolHandler "http://localhost:4200"'
    }
    $shortcut.WorkingDirectory = $InstallPath
    $shortcut.Description = "HubOn"
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Save()

    $legacyShortcut = Join-Path $desktop "HubOn.url"
    if (Test-Path -LiteralPath $legacyShortcut) {
        Remove-Item -LiteralPath $legacyShortcut -Force
    }
}

Assert-Administrator

$desktopExecutable = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path -LiteralPath $desktopExecutable)) {
    throw "Docker Desktop is not installed in the expected location."
}
$script:dockerCli = Resolve-DockerCli
$previousErrorActionPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = "Continue"
    & $script:dockerCli compose version 1>$null 2>$null
    $composeVersionExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
if ($composeVersionExitCode -ne 0) {
    throw "Docker Compose is not available."
}

Copy-HubonFiles
$installedEnvironment = Initialize-EnvironmentFile
Assert-EnvironmentFile -Path $installedEnvironment
Wait-DockerEngine

# Config output contains expanded environment values, so it is never printed or logged.
$composeFile = Join-Path $InstallPath "docker-compose.yml"
$previousErrorActionPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = "Continue"
    $configOutput = & $script:dockerCli compose `
        --project-directory $InstallPath `
        --env-file $installedEnvironment `
        -f $composeFile config 2>&1
    $configExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
if ($configExitCode -ne 0) {
    throw "docker compose config failed for the installed HubOn files."
}
if (($configOutput -join "`n") -match "(?i)hubon_test") {
    throw "The client Compose configuration must not reference hubon_test."
}

Invoke-Compose -Arguments @("build")
$startScript = Join-Path $InstallPath "scripts\start-hubon.ps1"
$windowsPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$startArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -EngineTimeoutSeconds {1} -HealthTimeoutSeconds {2}' -f `
    $startScript, $EngineTimeoutSeconds, $HealthTimeoutSeconds
$startProcess = Start-Process `
    -FilePath $windowsPowerShell `
    -ArgumentList $startArguments `
    -WindowStyle Hidden `
    -Wait `
    -PassThru
if ($startProcess.ExitCode -ne 0) {
    throw "HubOn did not become healthy after installation. Check logs\startup.log."
}

Register-HubonTask
New-HubonShortcut

Write-Host "HubOn installation completed successfully."
Write-Host "Installation path: $InstallPath"
Write-Host "Scheduled task: $taskName"
Write-Host "Client URL: http://localhost:4200"
