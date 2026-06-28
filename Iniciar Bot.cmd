@echo off
title Ticket Bot
cd /d "%~dp0"

if not exist ".env" (
  echo Arquivo .env nao encontrado.
  echo Configure o .env antes de iniciar o bot.
  pause
  exit /b 1
)

if not exist "build\index.js" (
  echo Build nao encontrado. Gerando build...
  call npm.cmd run build
  if errorlevel 1 (
    echo.
    echo Nao foi possivel gerar o build.
    pause
    exit /b 1
  )
)

node --env-file=.env .
pause
