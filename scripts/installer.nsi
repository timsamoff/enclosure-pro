; Additional installer script for Enclosure Pro
; Ensures clean installation and proper registry setup

Function .onInit
  ; Check for existing installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.enclosurepro.app" "UninstallString"
  StrCmp $0 "" done
  
  ; Ask user if they want to uninstall previous version
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "A previous version of Enclosure Pro is installed.$\n$\nDo you want to uninstall it before continuing?" \
    /SD IDYES IDNO done
  
  ; Execute uninstaller
  DetailPrint "Uninstalling previous version..."
  ExecWait '$0 /S _?=$INSTDIR'
  
  ; Clean up any remaining files
  RMDir /r "$LOCALAPPDATA\com.enclosurepro.app"
  RMDir /r "$APPDATA\com.enclosurepro.app"
  
  done:
FunctionEnd

Function un.onInit
  ; This runs when uninstaller starts
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Are you sure you want to completely remove Enclosure Pro and all of its components?" \
    /SD IDYES IDNO cancelUninstall
  Goto done
  
  cancelUninstall:
    Abort
  
  done:
FunctionEnd

Function un.onUninstSuccess
  ; Show success message after uninstall
  MessageBox MB_OK|MB_ICONINFORMATION \
    "Enclosure Pro was successfully removed from your computer." \
    /SD IDOK
FunctionEnd