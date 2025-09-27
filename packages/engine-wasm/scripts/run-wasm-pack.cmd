@echo off
setlocal
set "NODE_BIN="
if defined npm_node_execpath (
  set "NODE_BIN=%npm_node_execpath%"
) else (
  for %%I in (node.exe) do (
    if not defined NODE_BIN set "NODE_BIN=%%~$PATH:I"
  )
)
if not defined NODE_BIN (
  for /f "delims=" %%I in ('where node 2^>nul') do (
    if not defined NODE_BIN set "NODE_BIN=%%I"
  )
)
if not defined NODE_BIN (
  echo [run-wasm-pack] Unable to locate node.exe in environment.
  exit /b 1
)
for %%I in ("%NODE_BIN%") do set "NODE_DIR=%%~dpI"
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"
"%NODE_BIN%" "%~dp0run-wasm-pack.mjs" %*
exit /b %ERRORLEVEL%
