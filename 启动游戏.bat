@echo off
cd /d "%~dp0"
if not exist "dist\play.html" (echo Game build missing. Run npm run build. & pause & exit /b 1)
where node >nul 2>nul || goto offline
call :probe
if not errorlevel 1 goto open
start "jingge-server" /min node tools\serve.cjs 8123
ping -n 2 127.0.0.1 >nul
call :probe
if errorlevel 1 goto offline
:open
start "" http://localhost:8123/
exit /b
:offline
start "" "%~dp0dist\play.html"
exit /b
:probe
node -e "fetch('http://127.0.0.1:8123/',{signal:AbortSignal.timeout(1000)}).then(r=>r.text()).then(s=>process.exitCode=Number(!s.includes('id='+String.fromCharCode(34)+'playHud'))).catch(()=>process.exitCode=1)"
exit /b %errorlevel%
