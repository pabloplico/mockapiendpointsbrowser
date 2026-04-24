@echo off
cd /d "%~dp0"
echo Starting MockGen on http://localhost:8000
echo.
echo   MockGen UI:  http://localhost:8000/mockgen.html
echo   Demo app:    http://localhost:8000/
echo.
echo Press Ctrl+C to stop.
echo.
python -m http.server 8000
