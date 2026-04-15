@echo off
node "%~dp0bridge.mjs" --hook-type=subagent_stop
exit /b %ERRORLEVEL%
