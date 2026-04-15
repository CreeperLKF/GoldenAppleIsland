@echo off
node "%~dp0bridge.mjs" --hook-type=notification
exit /b %ERRORLEVEL%
