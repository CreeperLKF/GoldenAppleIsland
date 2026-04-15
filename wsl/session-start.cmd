@echo off
node "%~dp0bridge.mjs" --hook-type=session_start
exit /b %ERRORLEVEL%
