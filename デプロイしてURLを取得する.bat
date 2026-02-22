@echo off
cd /d "%~dp0"
npx vercel login
npx vercel --yes --prod
pause
