@echo off
setlocal
cd /d "%~dp0"
npm run layer-defaults:audit -- %*
