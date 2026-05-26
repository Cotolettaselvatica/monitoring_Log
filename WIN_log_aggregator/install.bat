@echo off
setlocal
cd /d "%~dp0"

echo === Installazione WIN Log Aggregator ===

where python >nul 2>&1
if errorlevel 1 (
    echo Python non trovato. Installa Python 3.11+ e riprova.
    exit /b 1
)

if not exist ".venv" (
    echo Creo virtualenv...
    python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt

if not exist "config\machines.yaml" (
    copy config\machines.example.yaml config\machines.yaml
    echo Creato config\machines.yaml - modificalo con i tuoi macchinari.
)

if not exist ".env" (
    copy .env.example .env
    echo Creato .env - inserisci credenziali PostgreSQL.
)

if not exist "state" mkdir state

echo.
echo Installazione completata.
echo 1. Modifica .env con credenziali PostgreSQL
echo 2. Modifica config\machines.yaml con le share SMB
echo 3. Esegui sql\schema.sql su PostgreSQL (estende tabella conteggi_pezzi)
echo 4. Avvia con run.bat
echo.
pause
