@echo off
setlocal
set "NODE_BIN=%npm_node_execpath%"
if "%NODE_BIN%"=="" set "NODE_BIN=node"
"%NODE_BIN%" "%~dp0run-wasm-pack.mjs" %*
exit /b %ERRORLEVEL%
