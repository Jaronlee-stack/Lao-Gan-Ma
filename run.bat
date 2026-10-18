@echo off
REM Lao Gan Ma - Windows one-command runner.
REM Double-click this file, or run it from PowerShell / cmd:  .\run.bat
REM It bypasses PowerShell execution-policy restrictions for this run only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
