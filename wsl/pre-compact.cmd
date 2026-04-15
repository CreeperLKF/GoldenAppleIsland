@echo off
node "%~dp0bridge.mjs" --hook-type=pre_compact
exit /b %ERRORLEVEL%
