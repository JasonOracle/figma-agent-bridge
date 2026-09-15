@echo off
rem figma-vibe CLI shim for cmd.exe / PowerShell
setlocal
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%cli\figma-vibe.js" %*
exit /b %ERRORLEVEL%
