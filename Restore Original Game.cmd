@echo off
setlocal
if not exist "%~dp0install.cjs" (
  echo Extract all files from the PPO ZIP before running this launcher.
  pause
  exit /b 1
)
where.exe node.exe >nul 2>&1
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org/en/download, then open this launcher again.
  pause
  exit /b 1
)
node "%~dp0install.cjs" restore %*
set "ppoExitCode=%ERRORLEVEL%"
pause
exit /b %ppoExitCode%
