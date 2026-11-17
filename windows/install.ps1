param([Parameter(Mandatory=$true)][string]$Setup,[Parameter(Mandatory=$true)][string]$Evidence,[switch]$Uninstall)
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
$installRoot=Join-Path $env:LOCALAPPDATA 'MysteryBoardStudio'
if ($Uninstall) {
  $update=Join-Path $installRoot 'Update.exe'
  if (!(Test-Path $update)) { throw 'Installed Update.exe missing' }
  $p=Start-Process -FilePath $update -ArgumentList '--uninstall --silent' -Wait -PassThru
  if ($p.ExitCode -ne 0) {throw "Uninstaller failed: $($p.ExitCode)"}
  if (Test-Path (Join-Path $installRoot 'app-0.2.0/MysteryBoard Studio.exe')) {throw 'Application EXE still installed'}
  @{passed=$true;event='uninstall';exitCode=$p.ExitCode;applicationExeRemoved=$true} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Evidence 'Deinstallation.json')
} else {
  $p=Start-Process -FilePath (Resolve-Path $Setup) -ArgumentList '--silent' -Wait -PassThru
  if ($p.ExitCode -ne 0) {throw "Installer failed: $($p.ExitCode)"}
  $exe=Join-Path $installRoot 'app-0.2.0/MysteryBoard Studio.exe'
  if (!(Test-Path $exe)) {throw 'Installer did not create actual application EXE'}
  # Squirrel may start a first-run instance after installation; stop only this
  # newly installed app before Playwright starts it with an isolated profile.
  Get-Process -Name 'MysteryBoard Studio' -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe} | Stop-Process
  "STUDIO_WINDOWS_INSTALLED=$exe" | Out-File -Append -Encoding utf8 $env:GITHUB_ENV
  @{passed=$true;event='install';setup=(Resolve-Path $Setup).Path;exitCode=$p.ExitCode;installedExe=$exe;userProfileInstall=$true;administrator=[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)} | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Evidence 'Installation.json')
  Get-AuthenticodeSignature $Setup | Select-Object Status,StatusMessage | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Evidence 'Signatur.json')
}
$log=Join-Path $env:LOCALAPPDATA 'SquirrelTemp/SquirrelSetup.log'
if(Test-Path $log){Copy-Item $log (Join-Path $Evidence 'SquirrelSetup.log') -Force}
