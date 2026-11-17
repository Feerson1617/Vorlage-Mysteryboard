param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Evidence)
$ErrorActionPreference='Stop'
$rows=@()
foreach($flag in @('--squirrel-install','--squirrel-updated','--squirrel-uninstall','--squirrel-obsolete')) {
 $p=Start-Process -FilePath $Executable -ArgumentList $flag -PassThru
 $deadline=[DateTime]::UtcNow.AddSeconds(25)
 $visible=$false
 while(!$p.HasExited -and [DateTime]::UtcNow -lt $deadline){
  $p.Refresh()
  if($p.MainWindowHandle -ne 0){$visible=$true}
  Start-Sleep -Milliseconds 50
 }
 if(!$p.HasExited){$p.Kill();throw "Squirrel event process did not exit: $flag"}
 $p.WaitForExit()
 if($visible -or $p.ExitCode -ne 0){throw "Unexpected window or process error for $flag ($($p.ExitCode))"}
 $rows+=@{flag=$flag;passed=$true;exitCode=$p.ExitCode;observedWindow=$visible;pid=$p.Id}
}
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
$rows | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $Evidence 'Squirrel-Ereignisse.json')
