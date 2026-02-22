@echo off
cd /d "%~dp0"
if exist "index.html" (
  start "" "%CD%\index.html"
) else if exist "心の相談室.html" (
  start "" "%CD%\心の相談室.html"
) else (
  echo No HTML file found
  pause
)
