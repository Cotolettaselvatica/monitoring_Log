@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Virtualenv non trovato. Esegui prima install.bat
    exit /b 1
)

call .venv\Scripts\activate.bat
python -m aggregator.main
exit /b %ERRORLEVEL%
