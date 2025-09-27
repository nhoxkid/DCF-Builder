@echo off
setlocal
set "NODE_BIN="

if defined npm_node_execpath (
  set "NODE_BIN=%npm_node_execpath%"
)

if not defined NODE_BIN if defined npm_execpath (
  for %%I in ("%npm_execpath%") do (
    if not defined NODE_BIN if exist "%%~dpInode.exe" set "NODE_BIN=%%~dpInode.exe"
  )
)

if not defined NODE_BIN (
  for %%I in (node.exe) do (
    if not defined NODE_BIN set "NODE_BIN=%%~$PATH:I"
  )
)

if not defined NODE_BIN (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
)

if not defined NODE_BIN (
  for /f "delims=" %%I in ('where node 2^>nul') do (
    if not defined NODE_BIN set "NODE_BIN=%%I"
  )
)

if not defined NODE_BIN (
  echo [run-wasm-pack] Unable to locate node.exe. Add Node to PATH or adjust this script.
  exit /b 1
)

for %%I in ("%NODE_BIN%") do set "NODE_DIR=%%~dpI"
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"

"%NODE_BIN%" "%~dp0run-wasm-pack.mjs" %*
exit /b %ERRORLEVEL%
