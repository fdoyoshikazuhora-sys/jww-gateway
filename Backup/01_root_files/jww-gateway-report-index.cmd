@echo off
setlocal
cd /d "%~dp0"
npm run reports:index -- %*
