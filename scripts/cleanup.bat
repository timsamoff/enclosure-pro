@echo off
echo Cleaning up Enclosure Pro installation...
echo.

REM Stop the application if running
taskkill /F /IM "Enclosure Pro.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul

REM Delete AppData folders
echo Removing AppData folders...
rmdir /s /q "%LOCALAPPDATA%\com.enclosurepro.app" 2>nul
rmdir /s /q "%APPDATA%\com.enclosurepro.app" 2>nul
rmdir /s /q "%TEMP%\com.enclosurepro.app" 2>nul
rmdir /s /q "%PROGRAMDATA%\com.enclosurepro.app" 2>nul

REM Delete installation folders
rmdir /s /q "%LOCALAPPDATA%\Programs\enclosure-pro" 2>nul
rmdir /s /q "%LOCALAPPDATA%\Enclosure Pro" 2>nul
rmdir /s /q "%APPDATA%\Enclosure Pro" 2>nul

REM Delete desktop shortcut
del "%USERPROFILE%\Desktop\Enclosure Pro.lnk" 2>nul

REM Delete start menu shortcut
rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Enclosure Pro" 2>nul

echo.
echo Cleanup completed!
echo.
pause