Param(
    [string]$BindHost = "0.0.0.0",
    [int]$BindPort = 5000,
    [switch]$InstallDeps
)

$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
    $venvActivate = Join-Path '.venv' 'Scripts\Activate.ps1'
    if (-not (Test-Path $venvActivate)) {
        Write-Error "找不到虛擬環境 .venv，請先在 server 目錄執行 'python -m venv .venv' 建立。"
        exit 1
    }

    . $venvActivate

    if ($InstallDeps) {
        pip install --upgrade pip
        pip install flask mysql-connector-python
    }

    flask --app app run --host $BindHost --port $BindPort
} finally {
    Pop-Location
}
