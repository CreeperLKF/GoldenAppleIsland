@echo off
node "%~dp0bridge.mjs" --hook-type=permission_request
exit /b %ERRORLEVEL%
