if not defined JAVA_HOME (
    if exist "%USERPROFILE%\jdk-17.0.14+7" set "JAVA_HOME=%USERPROFILE%\jdk-17.0.14+7"
    if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
if not defined ANDROID_HOME (
    if exist "%USERPROFILE%\android-sdk" set "ANDROID_HOME=%USERPROFILE%\android-sdk"
    if not defined ANDROID_HOME if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Accepting Android SDK licenses...
(for /l %%i in (1,1,20) do @echo y) | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses --sdk_root="%ANDROID_HOME%" >nul 2>&1

echo Installing platform-tools, platforms;android-36, build-tools;36.0.0...
(for /l %%i in (1,1,20) do @echo y) | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0" --sdk_root="%ANDROID_HOME%"
