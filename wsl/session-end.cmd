@echo off
node "%~dp0bridge.mjs" --hook-type=session_end
exit /b %ERRORLEVEL%
