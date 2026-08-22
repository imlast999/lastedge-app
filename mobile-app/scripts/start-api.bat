@echo off
:: ============================================================================
:: start-api.bat — Arranca solo el servidor Express de la API movil
::
:: Uso: ejecutar este script mientras bot.py corre en otra ventana.
:: El servidor lee bot_state.db en tiempo real; no requiere reiniciar
:: cuando el bot genera nuevos datos.
::
:: Puerto por defecto: 5000 (configurable en artifacts\api-server\.env)
:: ============================================================================

setlocal
set API_SERVER=%~dp0..\artifacts\api-server

:: Verificar que el .env existe
if not exist "%API_SERVER%\.env" (
    echo ERROR: No existe %API_SERVER%\.env
    echo Copia .env.example a .env y configura BOT_DB_PATH y API_SECRET.
    pause
    exit /b 1
)

:: Verificar que el dist esta compilado
if not exist "%API_SERVER%\dist\index.mjs" (
    echo AVISO: dist/ no existe. Compilando primero...
    cd /d "%API_SERVER%"
    :: Instalar deps minimas si node_modules no existe
    if not exist "%API_SERVER%\node_modules" (
        cd /d "%API_SERVER%\.."
        call pnpm install --ignore-scripts --filter @workspace/api-server
    )
    cd /d "%API_SERVER%"
    call node ./build.mjs
    if errorlevel 1 (
        echo ERROR: build fallo.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo  BOT-MT5 API Server
echo  Puerto: 5000 (ver .env para cambiar)
echo  Ctrl+C para detener
echo ============================================
echo.

cd /d "%API_SERVER%"

:: Cargar variables de entorno del .env y arrancar
for /f "usebackq tokens=1,* delims==" %%A in ("%API_SERVER%\.env") do (
    if not "%%A"=="" if not "%%A:~0,1%"=="#" set "%%A=%%B"
)

node --enable-source-maps dist\index.mjs

endlocal
