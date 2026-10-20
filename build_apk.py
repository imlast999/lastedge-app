#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
LastEdge App — Mobile Android APK Build & Compiler CLI (build_apk.py)
Interactive command-line interface for compiling and building installable Android APKs.
Compatible with Windows and PowerShell/CMD.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Force UTF-8 on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Windows ANSI color support
os.system("")

# ANSI Color Tokens
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
GRAY = "\033[90m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Project Paths
APP_ROOT = Path(__file__).parent.resolve()
MOBILE_DIR = APP_ROOT / "mobile-app"
ARTIFACTS_MOBILE_DIR = MOBILE_DIR / "artifacts" / "mobile"
ANDROID_DIR = ARTIFACTS_MOBILE_DIR / "android"
GRADLEW_BAT = ANDROID_DIR / "gradlew.bat"
DIST_DIR = APP_ROOT / "dist"
PACKAGE_JSON = ARTIFACTS_MOBILE_DIR / "package.json"

APP_PACKAGE_NAME = "com.lastedge.app"


def clear_screen() -> None:
    """Clear terminal console screen."""
    os.system("cls" if os.name == "nt" else "clear")


def get_file_sha256(filepath: Path) -> str:
    """Calculate SHA256 checksum of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def detect_java_home() -> Optional[Path]:
    """Auto-detect Java JDK home directory on Windows."""
    env_java = os.environ.get("JAVA_HOME")
    if env_java and Path(env_java).exists():
        return Path(env_java)

    candidates = [
        Path(r"C:\Program Files\Android\Android Studio\jbr"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Android Studio" / "jbr",
        Path(r"C:\Program Files\Java"),
        Path(r"C:\Program Files\Eclipse Adoptium"),
    ]

    for c in candidates:
        if c.exists():
            if (c / "bin" / "java.exe").exists():
                return c
            # Search child jdk folders
            for sub in c.glob("jdk*"):
                if (sub / "bin" / "java.exe").exists():
                    return sub

    # Fallback to checking java.exe on PATH
    try:
        out = subprocess.check_output("where java.exe", shell=True, stderr=subprocess.DEVNULL).decode().strip()
        if out:
            first_path = Path(out.splitlines()[0])
            potential_home = first_path.parent.parent
            if (potential_home / "bin" / "java.exe").exists():
                return potential_home
    except Exception:
        pass

    return None


def detect_android_home() -> Optional[Path]:
    """Auto-detect Android SDK home directory."""
    for key in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        val = os.environ.get(key)
        if val and Path(val).exists():
            return Path(val)

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        Path(local_app_data) / "Android" / "Sdk",
        Path(r"C:\Android\Sdk"),
        Path(os.environ.get("USERPROFILE", "")) / "AppData" / "Local" / "Android" / "Sdk",
    ]

    for c in candidates:
        if c.exists() and (c / "platform-tools").exists():
            return c

    return None


def get_build_environment() -> Dict[str, str]:
    """Construct an execution environment with detected Java and Android SDK paths."""
    env = os.environ.copy()
    java_home = detect_java_home()
    android_home = detect_android_home()

    extra_paths = []
    if java_home:
        env["JAVA_HOME"] = str(java_home)
        extra_paths.append(str(java_home / "bin"))

    if android_home:
        env["ANDROID_HOME"] = str(android_home)
        env["ANDROID_SDK_ROOT"] = str(android_home)
        extra_paths.append(str(android_home / "platform-tools"))
        extra_paths.append(str(android_home / "cmdline-tools" / "latest" / "bin"))

    if extra_paths:
        env["PATH"] = ";".join(extra_paths) + ";" + env.get("PATH", "")

    return env


def get_connected_devices() -> List[Dict[str, str]]:
    """Scan connected Android devices or emulators using adb."""
    env = get_build_environment()
    devices = []
    try:
        res = subprocess.run(
            ["adb", "devices", "-l"],
            capture_output=True,
            text=True,
            env=env,
            timeout=5,
        )
        if res.returncode == 0:
            for line in res.stdout.strip().splitlines()[1:]:
                parts = line.strip().split()
                if len(parts) >= 2 and parts[1] == "device":
                    serial = parts[0]
                    model = "Android Device"
                    for p in parts[2:]:
                        if p.startswith("model:"):
                            model = p.split(":", 1)[1]
                        elif p.startswith("device:"):
                            model += f" ({p.split(':', 1)[1]})"
                    devices.append({"serial": serial, "model": model, "status": parts[1]})
                elif len(parts) >= 2:
                    devices.append({"serial": parts[0], "model": "Unknown", "status": parts[1]})
    except Exception:
        pass
    return devices


def ensure_dependencies() -> bool:
    """Verify that node_modules are installed in the workspace."""
    nm_root = MOBILE_DIR / "node_modules"
    nm_mobile = ARTIFACTS_MOBILE_DIR / "node_modules"

    if nm_root.exists() or nm_mobile.exists():
        return True

    print(f"\n{YELLOW}[!] Mobile dependencies (node_modules) are missing.{RESET}")
    print(f"{GRAY}Running 'pnpm install --ignore-scripts' in {MOBILE_DIR}...{RESET}\n")

    env = get_build_environment()
    pnpm_exe = shutil.which("pnpm", path=env.get("PATH")) or "pnpm"
    try:
        subprocess.run([pnpm_exe, "install", "--ignore-scripts"], cwd=str(MOBILE_DIR), check=True, env=env, shell=(os.name == "nt"))
        print(f"\n{GREEN}[✓] Dependencies installed successfully.{RESET}\n")
        return True
    except Exception as e:
        print(f"\n{RED}[✗] Failed to install dependencies: {e}{RESET}\n")
        return False


def print_banner() -> None:
    """Display the top CLI banner and environment health status."""
    clear_screen()
    java_home = detect_java_home()
    android_home = detect_android_home()
    devices = get_connected_devices()

    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"{CYAN}{BOLD}       📱 LASTEDGE MOBILE — ANDROID APK COMPILER & BUILD SUITE{RESET}")
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")

    # Environment status line
    java_str = f"{GREEN}Ready{RESET} ({java_home.name})" if java_home else f"{RED}Missing (Install JDK 17+ / Android Studio){RESET}"
    sdk_str = f"{GREEN}Ready{RESET}" if android_home else f"{RED}Missing (Set ANDROID_HOME){RESET}"

    if devices:
        dev_names = ", ".join(d['model'] for d in devices)
        dev_str = f"{GREEN}{len(devices)} Connected{RESET} ({dev_names})"
    else:
        dev_str = f"{GRAY}None detected (Connect via USB with USB Debugging enabled){RESET}"

    print(f" {GRAY}Java JDK    :{RESET} {java_str}")
    print(f" {GRAY}Android SDK :{RESET} {sdk_str}")
    print(f" {GRAY}ADB Devices :{RESET} {dev_str}")
    print(f"{CYAN}{'-' * 75}{RESET}\n")

    print(f" {BOLD}--- [ 📦 APK BUILD & COMPILATION ] ---{RESET}")
    print(f"  [{GREEN}1{RESET}] Build Release APK ({BOLD}Recommended{RESET} — Signed, Standalone & Optimized)")
    print(f"  [{GREEN}2{RESET}] Build Debug APK (Fast Local Build with Debugging & Logs)")
    print(f"  [{GREEN}3{RESET}] Clean & Rebuild APK (Clean Cache + Fresh Assembly)")
    print(f"  [{GREEN}4{RESET}] Build APK via Expo EAS CLI (Local Preview Profile)\n")

    print(f" {BOLD}--- [ 📲 DEVICE DEPLOYMENT & TESTING ] ---{RESET}")
    print(f"  [{CYAN}5{RESET}] Install Latest APK to Connected Device (via ADB)")
    print(f"  [{CYAN}6{RESET}] Install & Launch LastEdge App on Device (One-Click Deploy)")
    print(f"  [{CYAN}7{RESET}] Start Expo Metro Development Server ({BOLD}pnpm dev{RESET})\n")

    print(f" {BOLD}--- [ 🛠️ DIAGNOSTICS & WORKSPACE TOOLS ] ---{RESET}")
    print(f"  [{YELLOW}8{RESET}] Environment Doctor (Comprehensive Toolchain Audit)")
    print(f"  [{YELLOW}9{RESET}] Open APK Output Directory in Windows Explorer ({BOLD}dist/{RESET})")
    print(f" [{YELLOW}10{RESET}] Install / Update Mobile Dependencies ({BOLD}pnpm install{RESET})\n")

    print(f"  [{GRAY}0{RESET}] Exit")
    print(f"{CYAN}{'=' * 75}{RESET}")


def run_gradle_build(variant: str = "release", clean: bool = False) -> bool:
    """
    Execute Gradle assemble task and export APK to LastEdge App/dist/.
    """
    if not GRADLEW_BAT.exists():
        print(f"\n{RED}[✗] Gradle wrapper not found at: {GRADLEW_BAT}{RESET}")
        return False

    if not ensure_dependencies():
        return False

    env = get_build_environment()
    if not env.get("JAVA_HOME"):
        print(f"\n{RED}[✗] JAVA_HOME could not be detected. Please install JDK 17 or Android Studio.{RESET}")
        return False

    if not env.get("ANDROID_HOME"):
        print(f"\n{RED}[✗] ANDROID_HOME could not be detected. Please configure Android SDK.{RESET}")
        return False

    task_name = f"assemble{variant.capitalize()}"
    print(f"\n{BOLD}{CYAN}Starting Gradle Build for variant: {variant.upper()}{RESET}")
    print(f"{GRAY}Target: {task_name}{RESET}")
    print(f"{GRAY}Working Directory: {ANDROID_DIR}{RESET}\n")

    t0 = time.time()

    if clean:
        print(f"{YELLOW}Cleaning previous build artifacts...{RESET}")
        subprocess.run([str(GRADLEW_BAT), "clean", "--no-daemon"], cwd=str(ANDROID_DIR), env=env)

    print(f"{GREEN}Compiling native modules and bundling JavaScript...{RESET}\n")
    build_cmd = [str(GRADLEW_BAT), task_name, "--no-daemon"]
    result = subprocess.run(build_cmd, cwd=str(ANDROID_DIR), env=env)

    elapsed = round(time.time() - t0, 1)

    if result.returncode != 0:
        print(f"\n{RED}[✗] Gradle build failed with exit code {result.returncode} ({elapsed}s){RESET}\n")
        return False

    # Locate generated APK
    outputs_dir = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / variant
    apk_candidates = list(outputs_dir.glob("*.apk"))

    if not apk_candidates:
        print(f"\n{RED}[✗] Build succeeded, but no APK was found in: {outputs_dir}{RESET}\n")
        return False

    source_apk = apk_candidates[0]
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    # Destination files
    dest_standard = DIST_DIR / f"lastedge-app-{variant}.apk"
    dest_versioned = DIST_DIR / f"LastEdge-Mobile-v1.0.0-{variant}.apk"

    shutil.copy2(source_apk, dest_standard)
    shutil.copy2(source_apk, dest_versioned)

    file_size_mb = round(dest_standard.stat().st_size / (1024 * 1024), 2)
    sha256 = get_file_sha256(dest_standard)

    print(f"\n{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"{GREEN}{BOLD}       🎉 ANDROID APK BUILD COMPLETED SUCCESSFULLY ({elapsed}s){RESET}")
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"  {BOLD}Variant   :{RESET} {variant.upper()}")
    print(f"  {BOLD}APK File  :{RESET} {dest_versioned.name}")
    print(f"  {BOLD}File Size :{RESET} {file_size_mb} MB")
    print(f"  {BOLD}SHA-256   :{RESET} {sha256}")
    print(f"  {BOLD}Location  :{RESET} {dest_standard}")
    print(f"{CYAN}{'=' * 75}{RESET}\n")

    return True


def run_eas_build() -> bool:
    """Run EAS CLI local build using the preview profile."""
    if not ensure_dependencies():
        return False

    env = get_build_environment()
    print(f"\n{BOLD}{CYAN}Starting EAS CLI Local APK Build (Profile: preview){RESET}\n")

    eas_cmd = shutil.which("eas", path=env.get("PATH")) or "eas"
    cmd = [eas_cmd, "build", "--platform", "android", "--local", "--profile", "preview"]
    try:
        res = subprocess.run(cmd, cwd=str(ARTIFACTS_MOBILE_DIR), env=env, shell=(os.name == "nt"))
        return res.returncode == 0
    except FileNotFoundError:
        print(f"\n{RED}[✗] EAS CLI is not installed globally. Install it via: npm install -g eas-cli{RESET}\n")
        return False
    except Exception as e:
        print(f"\n{RED}[✗] EAS build failed: {e}{RESET}\n")
        return False


def get_latest_apk() -> Optional[Path]:
    """Find the most recently created APK in dist/ or gradle output."""
    candidates = []
    if DIST_DIR.exists():
        candidates.extend(DIST_DIR.glob("*.apk"))

    outputs_dir = ANDROID_DIR / "app" / "build" / "outputs" / "apk"
    if outputs_dir.exists():
        candidates.extend(outputs_dir.rglob("*.apk"))

    if not candidates:
        return None

    # Sort by modification time descending
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def install_apk_to_device(launch_after: bool = False) -> bool:
    """Install APK to a connected Android phone or emulator via ADB."""
    devices = get_connected_devices()
    if not devices:
        print(f"\n{RED}[✗] No Android devices or emulators detected via ADB.{RESET}")
        print(f"{YELLOW}To connect your device:{RESET}")
        print(f"  1. Enable {BOLD}Developer Options{RESET} on your phone (Tap 'Build Number' 7 times).")
        print(f"  2. Turn on {BOLD}USB Debugging{RESET}.")
        print(f"  3. Connect via USB and accept the 'Allow USB Debugging' prompt on your screen.")
        print(f"  4. Verify with '{BOLD}adb devices{RESET}' in your terminal.\n")
        return False

    latest_apk = get_latest_apk()
    if not latest_apk:
        print(f"\n{YELLOW}[!] No compiled APK found. Please run Option 1 or 2 to compile an APK first.{RESET}\n")
        return False

    target_device = devices[0]
    print(f"\n{BOLD}{CYAN}Deploying APK to Android Device...{RESET}")
    print(f"  {BOLD}Target Device :{RESET} {target_device['model']} [{target_device['serial']}]")
    print(f"  {BOLD}APK File      :{RESET} {latest_apk.name} ({round(latest_apk.stat().st_size / (1024*1024), 2)} MB)\n")

    env = get_build_environment()
    cmd = ["adb", "-s", target_device["serial"], "install", "-r", str(latest_apk)]

    t0 = time.time()
    res = subprocess.run(cmd, env=env)
    elapsed = round(time.time() - t0, 1)

    if res.returncode == 0:
        print(f"\n{GREEN}[✓] APK successfully installed on {target_device['model']} in {elapsed}s!{RESET}")

        if launch_after:
            print(f"{CYAN}Launching LastEdge Mobile ({APP_PACKAGE_NAME})...{RESET}")
            launch_cmd = [
                "adb", "-s", target_device["serial"], "shell", "monkey",
                "-p", APP_PACKAGE_NAME, "-c", "android.intent.category.LAUNCHER", "1"
            ]
            subprocess.run(launch_cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"{GREEN}[✓] Application launched successfully.{RESET}\n")
        return True
    else:
        print(f"\n{RED}[✗] ADB installation failed. Check device permissions or storage space.{RESET}\n")
        return False


def run_doctor() -> None:
    """Run full toolchain diagnostics."""
    clear_screen()
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"{CYAN}{BOLD}       🔍 LASTEDGE MOBILE — ENVIRONMENT DIAGNOSTICS DOCTOR{RESET}")
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}\n")

    java_home = detect_java_home()
    android_home = detect_android_home()
    devices = get_connected_devices()
    env = get_build_environment()

    def check_cmd(cmd_list: list[str]) -> Tuple[bool, str]:
        try:
            cmd_name = cmd_list[0]
            # Use shutil.which to find pnpm.cmd, eas.cmd, etc. on Windows
            resolved = shutil.which(cmd_name, path=env.get("PATH"))
            target = [resolved or cmd_name] + cmd_list[1:]
            r = subprocess.run(
                target,
                capture_output=True,
                text=True,
                env=env,
                timeout=5,
                shell=(os.name == "nt"),
            )
            if r.returncode == 0:
                first_line = r.stdout.strip().splitlines()[0] if r.stdout else "OK"
                return True, first_line
            err_line = r.stderr.strip().splitlines()[0] if r.stderr else "Error"
            return False, err_line
        except Exception as e:
            return False, str(e)

    checks = []

    # 1. Java JDK
    if java_home:
        ok_java, ver_java = check_cmd(["java", "-version"])
        checks.append(("Java JDK Runtime", True, f"{java_home} ({ver_java or 'Valid'})"))
    else:
        checks.append(("Java JDK Runtime", False, "JAVA_HOME not set. Install JDK 17+ or Android Studio."))

    # 2. Android SDK
    if android_home:
        checks.append(("Android SDK Root", True, str(android_home)))
    else:
        checks.append(("Android SDK Root", False, "ANDROID_HOME not found. Install Android Studio SDK."))

    # 3. Gradle Wrapper
    if GRADLEW_BAT.exists():
        checks.append(("Gradle Wrapper", True, str(GRADLEW_BAT)))
    else:
        checks.append(("Gradle Wrapper", False, f"Missing at {GRADLEW_BAT}"))

    # 4. Node.js
    ok_node, ver_node = check_cmd(["node", "--version"])
    checks.append(("Node.js", ok_node, ver_node))

    # 5. PNPM Package Manager
    ok_pnpm, ver_pnpm = check_cmd(["pnpm", "--version"])
    checks.append(("PNPM Package Manager", ok_pnpm, f"v{ver_pnpm}" if ok_pnpm else ver_pnpm))

    # 6. EAS CLI
    ok_eas, ver_eas = check_cmd(["eas", "--version"])
    checks.append(("Expo EAS CLI", ok_eas, ver_eas if ok_eas else "Optional (npm install -g eas-cli)"))

    # 7. ADB & Devices
    ok_adb, ver_adb = check_cmd(["adb", "version"])
    if ok_adb:
        dev_text = f"{len(devices)} device(s) connected" if devices else "ADB active (0 devices connected)"
        checks.append(("Android Debug Bridge", True, dev_text))
    else:
        checks.append(("Android Debug Bridge", False, "adb not found in PATH or Android SDK"))

    # 8. Node Modules Workspace
    has_nm = (MOBILE_DIR / "node_modules").exists() or (ARTIFACTS_MOBILE_DIR / "node_modules").exists()
    checks.append(("Mobile Node Modules", has_nm, "Installed" if has_nm else "Missing (Run Option 10)"))

    for name, passed, details in checks:
        badge = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
        print(f"  {name:24} {badge} {GRAY}— {details}{RESET}")

    print(f"\n{CYAN}{'=' * 75}{RESET}")


def open_dist_folder() -> None:
    """Open the output dist directory in Windows Explorer."""
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n{GREEN}Opening output directory in Windows Explorer: {DIST_DIR}{RESET}")
    if os.name == "nt":
        os.system(f'explorer "{DIST_DIR}"')
    else:
        subprocess.run(["xdg-open", str(DIST_DIR)])


def start_expo_server() -> None:
    """Start Expo development server."""
    if not ensure_dependencies():
        return
    env = get_build_environment()
    print(f"\n{BOLD}{CYAN}Starting Expo Metro Development Server...{RESET}")
    print(f"{GRAY}Press Ctrl+C to stop the development server.{RESET}\n")
    try:
        subprocess.run(["pnpm", "exec", "expo", "start"], cwd=str(ARTIFACTS_MOBILE_DIR), env=env)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Development server stopped.{RESET}\n")


def parse_args() -> Optional[str]:
    """Parse command line flags for non-interactive execution."""
    parser = argparse.ArgumentParser(description="LastEdge Mobile Android APK Build CLI")
    parser.add_argument("--release", "-r", action="store_true", help="Build Release APK directly")
    parser.add_argument("--debug", "-d", action="store_true", help="Build Debug APK directly")
    parser.add_argument("--clean", "-c", action="store_true", help="Clean cache and build Release APK")
    parser.add_argument("--install", "-i", action="store_true", help="Install latest APK to connected device")
    parser.add_argument("--launch", "-l", action="store_true", help="Install and launch app on connected device")
    parser.add_argument("--doctor", action="store_true", help="Run environment diagnostics")
    parser.add_argument("--open", action="store_true", help="Open dist folder in Explorer")

    args = parser.parse_args()

    if args.release:
        return "1"
    if args.debug:
        return "2"
    if args.clean:
        return "3"
    if args.install:
        return "5"
    if args.launch:
        return "6"
    if args.doctor:
        return "8"
    if args.open:
        return "9"

    return None


def main() -> None:
    """Main interactive loop or non-interactive flag runner."""
    preset_choice = parse_args()
    is_non_interactive = preset_choice is not None

    while True:
        if preset_choice:
            choice = preset_choice
            preset_choice = None
        else:
            print_banner()
            try:
                choice = input(f" {BOLD}Select an option [0-10]: {RESET}").strip()
            except (KeyboardInterrupt, EOFError):
                print(f"\n\n{YELLOW}Exiting LastEdge Mobile APK Compiler.{RESET}\n")
                sys.exit(0)

        success = True
        if choice == "1":
            success = run_gradle_build(variant="release", clean=False)
        elif choice == "2":
            success = run_gradle_build(variant="debug", clean=False)
        elif choice == "3":
            success = run_gradle_build(variant="release", clean=True)
        elif choice == "4":
            success = run_eas_build()
        elif choice == "5":
            success = install_apk_to_device(launch_after=False)
        elif choice == "6":
            success = install_apk_to_device(launch_after=True)
        elif choice == "7":
            start_expo_server()
        elif choice == "8":
            run_doctor()
        elif choice == "9":
            open_dist_folder()
        elif choice == "10":
            success = ensure_dependencies()
        elif choice == "0":
            print(f"\n{GREEN}Exiting. Happy trading with LastEdge Mobile!{RESET}\n")
            sys.exit(0)
        else:
            print(f"\n{RED}Invalid selection. Please enter a number between 0 and 10.{RESET}")
            time.sleep(1)
            continue

        if is_non_interactive:
            sys.exit(0 if success else 1)

        input(f"\n{GRAY}Press Enter to continue...{RESET}")


if __name__ == "__main__":
    main()
