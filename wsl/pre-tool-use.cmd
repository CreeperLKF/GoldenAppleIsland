@echo off
node "%~dp0bridge.mjs"
if %ERRORLEVEL% EQU 0 (exit /b 0) else (exit /b 1)
