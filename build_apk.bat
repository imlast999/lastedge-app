@echo off
rem ==============================================================================
rem  LastEdge Android APK Builder CLI
rem  Dedicated build, packaging, and deployment suite for LastEdge Mobile App
rem ==============================================================================

chcp 65001 >nul
setlocal enabledelayedexpansion

:: Auto-detect and configure JAVA_HOME if not already present
if "%JAVA_HOME%"=="" (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    ) else if exist "%ProgramFiles%\Java\jdk-21" (
        set "JAVA_HOME=%ProgramFiles%\Java\jdk-21"
    ) else if exist "%ProgramFiles%\Java\jdk-17" (
        set "JAVA_HOME=%ProgramFiles%\Java\jdk-17"
    )
)

:: Auto-detect and configure ANDROID_HOME / ANDROID_SDK_ROOT
if "%ANDROID_HOME%"=="" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
        set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
    )
)

:: Ensure Android platform-tools (adb) are in PATH if available
if not "%ANDROID_HOME%"=="" (
    if exist "%ANDROID_HOME%\platform-tools\adb.exe" (
        set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
    )
)

:: Check for Python installation
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH.
    echo Please ensure Python 3.9+ is installed and added to your system PATH.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Launch the LastEdge Android APK Builder CLI
python -X utf8 "%~dp0build_apk.py" %*
exit /b %ERRORLEVEL%
