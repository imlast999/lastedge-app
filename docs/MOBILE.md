# LastEdge App — Mobile Application (React Native / Expo)

> **Module:** `LastEdge App`  
> **Source Directory:** `mobile-app/`  

---

## 2. Android APK Builder CLI (`build_apk.bat`)

The mobile application includes a dedicated, interactive Command Line Interface (`build_apk.bat` / `build_apk.py`) designed for compiling, packaging, testing, and deploying installable Android `.apk` files directly to Android phones or emulators.

### Quick Start
To launch the interactive build menu, run from the `LastEdge App/` root:
```cmd
build_apk.bat
```

### Key CLI Features
- **[1] Build Release APK**: Compiles an optimized, standalone release APK signed with debug keystore for direct sideloading and testing on any Android phone.
- **[2] Build Debug APK**: Compiles a debug APK with full developer logging enabled.
- **[3] Clean & Rebuild**: Cleans previous Gradle cache and executes a fresh compilation.
- **[4] Build via Expo EAS**: Generates APK using Expo Application Services (local preview profile).
- **[5] Install via ADB**: Automatically detects connected Android phones via USB/Wi-Fi and runs `adb install -r`.
- **[6] One-Click Deploy & Launch**: Installs the APK and immediately starts the app on device.
- **[7] Expo Metro Server**: Launches the local development server for live updates.
- **[8] Environment Doctor**: Validates JDK, Android SDK, ADB, Node, PNPM, and dependencies.
- **[9] Open Dist Folder**: Opens the `dist/` directory containing the compiled APKs in Windows Explorer.

### Non-Interactive Command-Line Flags
You can also run builds directly without entering the interactive menu:
```cmd
build_apk.bat --doctor       # Run toolchain diagnostic checks
build_apk.bat --release      # Compile standalone release APK
build_apk.bat --debug        # Compile debug APK
build_apk.bat --clean        # Clean cache and build release APK
build_apk.bat --install      # Install latest APK to connected phone
build_apk.bat --launch       # Install and start app on phone
build_apk.bat --open         # Open dist/ folder in Explorer
```

### Output Location
Compiled APKs are automatically exported to:
- `LastEdge App/dist/lastedge-app-release.apk`
- `LastEdge App/dist/LastEdge-Mobile-v1.0.0-release.apk`

