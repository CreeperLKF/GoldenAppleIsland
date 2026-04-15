@echo off
node "%~dp0bridge.mjs" --hook-type=stop
exit /b %ERRORLEVEL%
