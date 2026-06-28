@echo off
title Ticket Bot
cd /d "%~dp0"
node --env-file=.env .
pause
