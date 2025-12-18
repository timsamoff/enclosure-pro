; Custom Uninstall Macro for Enclosure Pro
; This ensures ALL app data is removed during uninstallation

!macro customUnInstall
  ; Log uninstall start
  DetailPrint "Starting custom uninstallation for Enclosure Pro..."
  
  ; Stop the application if it's running
  ExecWait 'taskkill /F /IM "Enclosure Pro.exe" /T'
  Sleep 1000
  
  ; Delete AppData folders
  DetailPrint "Removing AppData folders..."
  
  ; Local AppData
  RMDir /r "$LOCALAPPDATA\com.enclosurepro.app"
  IfErrors 0 +2
    DetailPrint "Failed to delete LOCALAPPDATA folder (may not exist)"
  
  ; Roaming AppData
  RMDir /r "$APPDATA\com.enclosurepro.app"
  IfErrors 0 +2
    DetailPrint "Failed to delete APPDATA folder (may not exist)"
  
  ; Temp folder
  RMDir /r "$TEMP\com.enclosurepro.app"
  IfErrors 0 +2
    DetailPrint "Failed to delete TEMP folder (may not exist)"
  
  ; ProgramData (for machine-wide data)
  RMDir /r "$PROGRAMDATA\com.enclosurepro.app"
  IfErrors 0 +2
    DetailPrint "Failed to delete PROGRAMDATA folder (may not exist)"
  
  ; Delete registry entries
  DetailPrint "Removing registry entries..."
  
  ; User-specific registry keys
  DeleteRegKey HKCU "Software\com.enclosurepro.app"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.enclosurepro.app"
  
  ; Machine-specific registry keys (if installed per-machine)
  DeleteRegKey HKLM "Software\com.enclosurepro.app"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.enclosurepro.app"
  
  ; Clean up from previous installations
  RMDir /r "$LOCALAPPDATA\Programs\enclosure-pro"
  RMDir /r "$LOCALAPPDATA\Enclosure Pro"
  RMDir /r "$APPDATA\Enclosure Pro"
  
  ; Delete desktop shortcuts
  Delete "$DESKTOP\Enclosure Pro.lnk"
  
  ; Delete start menu shortcuts
  SetShellVarContext current
  RMDir /r "$SMPROGRAMS\Enclosure Pro"
  
  DetailPrint "Custom uninstallation completed."
!macroend

!macro customInit
  ; This runs before installation begins
  ; Check if app is running and close it
  ExecWait 'taskkill /F /IM "Enclosure Pro.exe" /T'
  Sleep 1000
!macroend