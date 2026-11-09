@echo off
rem ==============================================================================
rem  LastEdge Google Play Store AAB Bundle Builder
rem  Compiles signed, optimized Android App Bundle (.aab) protected from public git
rem ==============================================================================

chcp 65001 >nul
setlocal enabledelayedexpansion

:: Launch the LastEdge Android APK Builder CLI with --bundle flag
python -X utf8 "%~dp0build_apk.py" --bundle %*
exit /b %ERRORLEVEL%
