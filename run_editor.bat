@echo off
setlocal
cd /d "%~dp0"

python -c "import sys; raise SystemExit(sys.version_info.major != 3)" >nul 2>&1
if errorlevel 1 (
  echo Python 3 was not found. Install Python 3 and make sure "python" is on PATH.
  pause
  exit /b 1
)

start "BladeBones local server" /min cmd /k "python -m http.server 8000 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"

echo BladeBones is open at http://127.0.0.1:8000/index.html
echo Close the minimized server window to stop the local server.
