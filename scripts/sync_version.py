#!/usr/bin/env python3
"""
LastEdge Mobile App — Automated Dynamic Version Sync
scripts/sync_version.py

Calculates the next dynamic version based on Git commit count and synchronizes:
1. mobile-app/artifacts/mobile/app.json
2. mobile-app/artifacts/mobile/package.json
3. mobile-app/package.json
4. mobile-app/artifacts/mobile/android/app/build.gradle
5. Exports variables to $GITHUB_OUTPUT if running inside GitHub Actions.
"""

from __future__ import annotations

import os
import sys
import json
import re
import subprocess
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent
MOBILE_ROOT = REPO_ROOT / "mobile-app"
MOBILE_APP_DIR = MOBILE_ROOT / "artifacts" / "mobile"
APP_JSON_PATH = MOBILE_APP_DIR / "app.json"
MOBILE_PKG_JSON = MOBILE_APP_DIR / "package.json"
ROOT_PKG_JSON = MOBILE_ROOT / "package.json"
BUILD_GRADLE_PATH = MOBILE_APP_DIR / "android" / "app" / "build.gradle"

BASE_VERSION = "1.1"


def get_git_commit_count() -> int:
    """Gets total commit count in current repository branch."""
    try:
        res = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=True
        )
        count = int(res.stdout.strip())
        return max(count, 1)
    except Exception:
        # Fallback if git is not available or shallow clone without history
        fallback_file = REPO_ROOT / "VERSION"
        if fallback_file.exists():
            try:
                content = fallback_file.read_text(encoding="utf-8").strip()
                parts = content.split(".")
                return int(parts[-1]) + 1
            except Exception:
                pass
        return 34


def sync_version():
    commit_count = get_git_commit_count()
    version_str = f"{BASE_VERSION}.{commit_count}"
    version_code = commit_count

    print("=" * 60)
    print(f"🚀 Sincronizando Versión de LastEdge Mobile:")
    print(f"   • Versión (versionName): {version_str}")
    print(f"   • Código (versionCode):  {version_code}")
    print("=" * 60)

    # 1. Update app.json
    if APP_JSON_PATH.exists():
        with open(APP_JSON_PATH, "r", encoding="utf-8") as f:
            app_data = json.load(f)
        app_data.setdefault("expo", {})["version"] = version_str
        app_data["expo"].setdefault("android", {})["versionCode"] = version_code
        with open(APP_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(app_data, f, indent=2)
        print(f"✅ Actualizado: {APP_JSON_PATH.relative_to(REPO_ROOT)}")

    # 2. Update mobile package.json
    if MOBILE_PKG_JSON.exists():
        with open(MOBILE_PKG_JSON, "r", encoding="utf-8") as f:
            pkg_data = json.load(f)
        pkg_data["version"] = version_str
        with open(MOBILE_PKG_JSON, "w", encoding="utf-8") as f:
            json.dump(pkg_data, f, indent=2)
        print(f"✅ Actualizado: {MOBILE_PKG_JSON.relative_to(REPO_ROOT)}")

    # 3. Update root mobile package.json
    if ROOT_PKG_JSON.exists():
        with open(ROOT_PKG_JSON, "r", encoding="utf-8") as f:
            root_pkg = json.load(f)
        root_pkg["version"] = version_str
        with open(ROOT_PKG_JSON, "w", encoding="utf-8") as f:
            json.dump(root_pkg, f, indent=2)
        print(f"✅ Actualizado: {ROOT_PKG_JSON.relative_to(REPO_ROOT)}")

    # 4. Update build.gradle
    if BUILD_GRADLE_PATH.exists():
        gradle_text = BUILD_GRADLE_PATH.read_text(encoding="utf-8")
        # Replace versionName
        gradle_text = re.sub(
            r'versionName\s+["\'][^"\']+["\']',
            f'versionName "{version_str}"',
            gradle_text
        )
        # Replace versionCode
        gradle_text = re.sub(
            r'versionCode\s+([0-9]+|\(\([^\r\n]+\)\))',
            f'versionCode {version_code}',
            gradle_text
        )
        BUILD_GRADLE_PATH.write_text(gradle_text, encoding="utf-8")
        print(f"✅ Actualizado: {BUILD_GRADLE_PATH.relative_to(REPO_ROOT)}")

    # 5. Persist VERSION file
    version_file = REPO_ROOT / "VERSION"
    version_file.write_text(f"{version_str}\n", encoding="utf-8")
    print(f"✅ Archivo VERSION escrito: {version_str}")

    # 6. GitHub Actions output environment
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output and os.path.exists(github_output):
        with open(github_output, "a", encoding="utf-8") as gh:
            gh.write(f"VERSION={version_str}\n")
            gh.write(f"VERSION_CODE={version_code}\n")
            gh.write(f"APK_NAME=LastEdge-v{version_str}.apk\n")
        print(f"✅ Exportadas variables a GITHUB_OUTPUT: LastEdge-v{version_str}.apk")


if __name__ == "__main__":
    sync_version()
