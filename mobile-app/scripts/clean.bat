@echo off
:: ============================================================================
:: clean.bat — Elimina node_modules, caches de Gradle y dist compilados
::             para liberar espacio en disco (~20 GB).
::
:: Para volver a compilar, ejecuta build-apk.bat que reinstala todo
:: automáticamente antes del build.
:: ============================================================================

setlocal
set ROOT=%~dp0..
set MOBILE=%ROOT%\artifacts\mobile
set API=%ROOT%\artifacts\api-server

echo.
echo Limpiando node_modules y caches de build...
echo.

if exist "%MOBILE%\node_modules" (
    echo  - mobile\node_modules
    rmdir /s /q "%MOBILE%\node_modules"
)
if exist "%API%\node_modules" (
    echo  - api-server\node_modules
    rmdir /s /q "%API%\node_modules"
)
if exist "%MOBILE%\android\app\.cxx" (
    echo  - android\app\.cxx  ^(cache compilacion nativa^)
    rmdir /s /q "%MOBILE%\android\app\.cxx"
)
if exist "%MOBILE%\android\.gradle" (
    echo  - android\.gradle  ^(cache Gradle^)
    rmdir /s /q "%MOBILE%\android\.gradle"
)
if exist "%MOBILE%\android\app\build" (
    echo  - android\app\build  ^(outputs Gradle^)
    rmdir /s /q "%MOBILE%\android\app\build"
)
if exist "%API%\dist" (
    echo  - api-server\dist  ^(bundle compilado^)
    rmdir /s /q "%API%\dist"
)

echo.
echo Listo. El codigo fuente no fue tocado.
echo Para recompilar: ejecuta scripts\build-apk.bat
echo.

endlocal
