$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$nodeMajor = node -p "process.versions.node.split('.')[0]"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($nodeMajor -ne "26") {
    Write-Error "Node.js 26 is required. Current: $(node -v)"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Error "Java is not on PATH."
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
if (-not $env:ANDROID_HOME) {
    Write-Error "Set ANDROID_HOME to the Android SDK."
}

$ndkVersion = "27.1.12297006"
$cmakeVersion = "3.31.6"
$ndk = Join-Path $env:ANDROID_HOME "ndk\$ndkVersion"
$cmake = Join-Path $env:ANDROID_HOME "cmake\$cmakeVersion"
if (-not (Test-Path $ndk) -or -not (Test-Path $cmake)) {
    Write-Error "Install NDK $ndkVersion and CMake $cmakeVersion in the Android SDK."
}

if (-not (Test-Path "node_modules")) {
    npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$androidDir = Join-Path $root "apps\mobile\android"
$localProperties = Join-Path $androidDir "local.properties"
if (-not (Test-Path $localProperties)) {
    $sdkDir = $env:ANDROID_HOME.Replace("\", "\\")
    Set-Content -Path $localProperties -Value "sdk.dir=$sdkDir" -Encoding ascii
}

Push-Location $androidDir
try {
    & .\gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
    Write-Error "The release APK was not produced."
}

$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Copy-Item $apk (Join-Path $dist "mobile-release.apk") -Force
Write-Output "APK: $(Join-Path $dist "mobile-release.apk")"
