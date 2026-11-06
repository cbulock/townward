$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    $bunExecutable = Get-Command bun -ErrorAction SilentlyContinue
    $bunPath = if ($bunExecutable) { $bunExecutable.Source } else { Join-Path $projectRoot '.tools/bun-windows-x64/bun.exe' }
    if (!(Test-Path -LiteralPath $bunPath)) { throw 'Install Bun or add it to PATH.' }
    $env:PATH = "$(Split-Path -Parent $bunPath);$env:PATH"
    if (!$env:JAVA_HOME -and (Test-Path 'C:/Program Files/Android/Android Studio/jbr')) { $env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr' }
    if (!$env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
    & $bunPath run android:sync
    if ($LASTEXITCODE -ne 0) { throw 'Native web build or Capacitor sync failed.' }
    & ./android/gradlew.bat -p android assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android assembly failed.' }
    New-Item -ItemType Directory -Force artifacts | Out-Null
    Copy-Item -LiteralPath android/app/build/outputs/apk/debug/app-debug.apk -Destination artifacts/Openpolis-debug.apk
    Write-Host 'Created artifacts/Openpolis-debug.apk'
} finally { Pop-Location }
