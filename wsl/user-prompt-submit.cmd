@echo off
node "%~dp0bridge.mjs" --hook-type=user_prompt_submit
exit /b %ERRORLEVEL%
