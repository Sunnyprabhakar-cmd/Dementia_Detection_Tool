$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Set-EnvDefault([string]$Path, [string]$Key, [string]$Value) {
    $lines = @(Get-Content -LiteralPath $Path)
    $pattern = "^\s*" + [regex]::Escape($Key) + "\s*="
    $index = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $pattern) {
            $index = $i
            break
        }
    }
    if ($index -lt 0) {
        Add-Content -LiteralPath $Path -Value "$Key=$Value"
        return
    }
    if ($lines[$index] -match "^\s*" + [regex]::Escape($Key) + "\s*=\s*$") {
        $lines[$index] = "$Key=$Value"
        Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
    }
}

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$FailureMessage) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)."
    }
}

Write-Step "Checking Node.js, npm, Python, and PostgreSQL prerequisites"
$nodeVersionText = (& node --version 2>$null)
if (-not $nodeVersionText -or $nodeVersionText -notmatch "^v(\d+)\.(\d+)\.(\d+)") {
    throw "Node.js is required. Install a current Node.js LTS release and rerun: https://nodejs.org/"
}
$nodeMajor = [int]$Matches[1]
$nodeMinor = [int]$Matches[2]
if (-not ($nodeMajor -ge 22 -or ($nodeMajor -eq 20 -and $nodeMinor -ge 19))) {
    throw "Node.js $nodeVersionText is unsupported by Vite 8. Install Node.js 20.19+ or 22.12+."
}
$npmVersionText = (& npm --version 2>$null)
if ($LASTEXITCODE -ne 0) {
    throw "npm is not available. Repair the Node.js installation and reopen PowerShell."
}
Write-Host "Node.js $nodeVersionText; npm $npmVersionText"

$postgresServices = @(Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue)
if (-not $postgresServices.Count) {
    throw "PostgreSQL service was not found. Install PostgreSQL 15+ and start its Windows service, then rerun setup."
}
$runningPostgres = @($postgresServices | Where-Object { $_.Status -eq "Running" })
if (-not $runningPostgres.Count) {
    throw "PostgreSQL is installed but not running. Start its service (for example, Start-Service postgresql-x64-18) and rerun setup."
}
Write-Host "PostgreSQL service is running."

$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        throw "Python 3.11+ is required. Install Python from https://www.python.org/downloads/windows/ and rerun setup."
    }
    $candidateVersion = (& $pythonCommand.Source --version 2>&1 | Out-String).Trim()
    if ($candidateVersion -notmatch "Python (\d+)\.(\d+)") {
        throw "Could not determine Python version. Install Python 3.11 or newer."
    }
    if ([int]$Matches[1] -lt 3 -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -lt 11)) {
        throw "$candidateVersion is too old. Install Python 3.11 or newer."
    }
    Invoke-Checked $pythonCommand.Source @("-m", "venv", ".venv") "Could not create the project Python environment"
}
$pythonVersionText = (& $pythonExe --version 2>&1 | Out-String).Trim()
if ($pythonVersionText -notmatch "Python (\d+)\.(\d+)") {
    throw "Could not determine the project virtual-environment Python version."
}
if ([int]$Matches[1] -lt 3 -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -lt 11)) {
    throw "$pythonVersionText is too old. Recreate .venv with Python 3.11+."
}
Write-Host "Project Python: $pythonVersionText"

Write-Step "Creating missing local environment files without overwriting existing settings"
$backendEnv = Join-Path $root "Backend\.env"
$backendExample = Join-Path $root "Backend\.env.example"
if (-not (Test-Path -LiteralPath $backendEnv)) {
    Copy-Item -LiteralPath $backendExample -Destination $backendEnv
}
Set-EnvDefault $backendEnv "NODE_ENV" "development"
Set-EnvDefault $backendEnv "PORT" "3001"
Set-EnvDefault $backendEnv "DB_HOST" "localhost"
Set-EnvDefault $backendEnv "DB_PORT" "5432"
Set-EnvDefault $backendEnv "DB_USER" "postgres"
Set-EnvDefault $backendEnv "DB_NAME" "mindscan"
Set-EnvDefault $backendEnv "JWT_SECRET" ""
$secretLine = Get-Content -LiteralPath $backendEnv | Where-Object { $_ -match "^\s*JWT_SECRET\s*=" } | Select-Object -First 1
if ($secretLine -match "^\s*JWT_SECRET\s*=\s*$") {
    $secretBytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($secretBytes) } finally { $generator.Dispose() }
    $generatedSecret = [Convert]::ToBase64String($secretBytes)
    Set-EnvDefault $backendEnv "JWT_SECRET" $generatedSecret
    Write-Host "Generated a local JWT secret (value hidden)."
}

$frontendEnv = Join-Path $root "Frontend\.env.local"
if (-not (Test-Path -LiteralPath $frontendEnv)) {
    Copy-Item -LiteralPath (Join-Path $root "Frontend\.env.example") -Destination $frontendEnv
}
Set-EnvDefault $frontendEnv "VITE_API_BASE_URL" "http://localhost:3001"

Write-Step "Installing exact dependencies from existing lockfiles"
foreach ($project in @("Backend", "Frontend")) {
    $lock = Join-Path $root "$project\package-lock.json"
    if (-not (Test-Path -LiteralPath $lock)) {
        throw "$project\package-lock.json is missing; restore the committed lockfile before setup."
    }
    $modules = Join-Path $root "$project\node_modules"
    $dependenciesReady = $false
    if (Test-Path -LiteralPath $modules) {
        $previousErrorPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & npm --prefix $project ls --depth=0 --parseable *> $null
        $dependenciesReady = $LASTEXITCODE -eq 0
        $ErrorActionPreference = $previousErrorPreference
    }
    if ($dependenciesReady) {
        Write-Host "$project dependencies already satisfy the package manifest."
    } elseif (Test-Path -LiteralPath $modules) {
        Write-Host "$project dependency tree is incomplete; repairing from its lockfile without removing the existing tree."
        Invoke-Checked "npm" @("install", "--prefix", $project, "--no-audit", "--no-fund") "npm install failed for $project"
    } else {
        Invoke-Checked "npm" @("ci", "--prefix", $project) "npm ci failed for $project"
    }
}

$trainingRequirements = Join-Path $root "Backend\ml\requirements-training.txt"
$trainingPackages = @(& $pythonExe -m pip freeze)
$trainingVersionsOk = ($trainingPackages -contains "joblib==1.6.0") -and
    ($trainingPackages -contains "numpy==2.5.3") -and
    ($trainingPackages -contains "pandas==3.0.6") -and
    ($trainingPackages -contains "scikit-learn==1.9.1")
if (-not $trainingVersionsOk) {
    Invoke-Checked $pythonExe @("-m", "pip", "install", "-r", $trainingRequirements) "Pinned research Python dependencies could not be installed"
}

$audioPython = Join-Path $root ".venv-audio\Scripts\python.exe"
if (Test-Path -LiteralPath $audioPython) {
    $audioReady = & $audioPython -c "import faster_whisper; print('ready')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked $audioPython @("-m", "pip", "install", "-r", (Join-Path $root "Backend\ml\requirements-audio.txt")) "Optional faster-whisper dependencies could not be installed"
    }
} else {
    Write-Host "Optional transcription environment .venv-audio is absent; core app setup continues without local speech transcription."
}

Write-Step "Ensuring the configured local database exists and applying safe migrations"
Invoke-Checked "npm" @("--prefix", "Backend", "run", "database:ensure") "PostgreSQL setup failed"
Invoke-Checked "npm" @("--prefix", "Backend", "run", "migrate") "Database migration failed"

Write-Step "Setup completed"
Write-Host "Start the API and Vite client together with: npm run dev"
Write-Host "Frontend: http://127.0.0.1:5173/  API health: http://127.0.0.1:3001/api/health"
Write-Host "Whisper model weights are not downloaded by setup. Transcription requires the configured model to already be cached for offline use."
