@echo off
node "%~dp0bridge.mjs" --hook-type=post_tool_use
exit /b %ERRORLEVEL%
