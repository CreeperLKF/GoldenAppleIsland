@echo off
node "%~dp0bridge.mjs" --hook-type=pre_tool_use
exit /b %ERRORLEVEL%
