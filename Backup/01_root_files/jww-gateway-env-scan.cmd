@echo off
setlocal
cd /d "%~dp0"
npm run env:scan -- %*
