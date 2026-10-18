@echo off
REM Lao Gan Ma - shortest launcher.
REM In PowerShell or cmd, from the project folder, just type:  go
REM (Windows runs .bat files by name, so no ".\" prefix is needed.)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
