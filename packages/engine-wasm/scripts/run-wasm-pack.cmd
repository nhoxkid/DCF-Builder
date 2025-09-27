@echo off
setlocal
set "NODE_BIN="

REM 1) Check pnpm?s node path
if defined npm_node_execpath (
  set "NODE_BIN=%npm_node_execpath%"
)

REM 2) Check next to npm_execpath (pnpm sometimes sets this only)
if not defined NODE_BIN if defined npm_execpath (
  for %%I in ("%npm_execpath%") do (
    if not defined NODE_BIN if exist "%%~dpInode.exe" set "NODE_BIN=%%~dpInode.exe"
  )
)

REM 3) See if node.exe is already on PATH
if not defined NODE_BIN (
  for %%I in (node.exe) do (
    if not defined NODE_BIN set "NODE_BIN=%%~$PATH:I"
  )
)

REM 4) Fallback to your installed path
if not defined NODE_BIN (
  set "NODE_BIN=C:\Program Files\nodejs\node.exe"
  if not exist "%NODE_BIN%" (
    echo [run-wasm-pack] Expected node at C:\Program Files\nodejs\node.exe but it was not found.
    exit /b 1
  )
)

REM 5) Last resort: use `where node`
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
