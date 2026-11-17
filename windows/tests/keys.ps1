param([int]$ApplicationProcessId, [string]$Keys)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class StudioFocus {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
}
'@
$target = Get-Process -Id $ApplicationProcessId
if ($target.MainWindowHandle -eq 0) { throw 'No native application window' }
[StudioFocus]::ShowWindow($target.MainWindowHandle, 9) | Out-Null
$focused = [StudioFocus]::SetForegroundWindow($target.MainWindowHandle)
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Write-Output "Native SendKeys: pid=$ApplicationProcessId keys=$Keys foreground=$focused"
