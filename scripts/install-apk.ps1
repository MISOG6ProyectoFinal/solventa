param(
    [Parameter(Position = 0)]
    [string]$Serial
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apk = Join-Path $root "dist\mobile-release.apk"
if (-not (Test-Path $apk)) {
    Write-Error "APK not found. Run scripts\build-apk.ps1 first."
}

if (-not $env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) {
    $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
}
if (-not $env:ANDROID_HOME) {
    $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
    }
}

$adb = $null
$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCommand) {
    $adb = $adbCommand.Source
} elseif ($env:ANDROID_HOME) {
    $candidate = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    if (Test-Path $candidate) {
        $adb = $candidate
    }
}
if (-not $adb) {
    Write-Error "adb is not on PATH."
}

$adbArgs = @()
if ($Serial) {
    $adbArgs += @("-s", $Serial)
}
$adbArgs += @("install", "-r", $apk)
& $adb @adbArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
