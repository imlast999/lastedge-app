#!/usr/bin/env python3
"""
LastEdge Mobile App — Semantic Release Notes & Changelog Drafter
scripts/generate_release_notes.py

Parses Git commit history since the previous release tag (or fallback to recent commits)
and generates:
1. An institutional Markdown release document (release_notes.md) for GitHub Releases.
2. A concise summary (release_summary.txt) formatted for Telegram and Discord broadcast.
3. Automatically categorizes commits into:
   - 🚀 Features & Modules
   - 🛡️ Risk & Protection Guards
   - 🐛 Bug Fixes & Stability
   - 🎨 UI, Mobile & Typography (Nexa + Jakarta Sans)
   - ⚡ CI/CD, Build & Infrastructure
"""

from __future__ import annotations

import os
import sys
import re
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Tuple

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parent.parent


def get_previous_tag() -> str | None:
    """Finds the most recent Git release tag if one exists."""
    try:
        res = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0", "HEAD^"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=True
        )
        tag = res.stdout.strip()
        return tag if tag else None
    except Exception:
        return None


def get_commits_since_tag(tag: str | None) -> List[Tuple[str, str]]:
    """Returns list of (short_sha, message) tuples since tag or last 25 commits."""
    cmd = ["git", "log", "--pretty=format:%h|||%s"]
    if tag:
        cmd.append(f"{tag}..HEAD")
    else:
        cmd.extend(["-n", "25", "HEAD"])

    try:
        res = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=True
        )
        lines = res.stdout.strip().split("\n")
        commits = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            parts = line.split("|||", 1)
            if len(parts) == 2:
                commits.append((parts[0], parts[1]))
        return commits
    except Exception as e:
        print(f"Warning: could not read git log: {e}")
        return []


def categorize_commits(commits: List[Tuple[str, str]]) -> Dict[str, List[Tuple[str, str]]]:
    """Sorts commits into semantic categories based on prefix and keywords."""
    categories: Dict[str, List[Tuple[str, str]]] = {
        "🚀 Funcionalidades y Mejoras": [],
        "🛡️ Gestión de Riesgo y Salvaguardas": [],
        "🐛 Correcciones y Hardening": [],
        "🎨 UI, Móvil y Tipografía": [],
        "⚡ Infraestructura, CI/CD y Mantenimiento": []
    }

    for sha, msg in commits:
        low = msg.lower()

        # Risk & Protection
        if any(k in low for k in ["risk", "guard", "weekend", "stop loss", "sl", "tp", "trailing", "breaker", "drawdown"]):
            categories["🛡️ Gestión de Riesgo y Salvaguardas"].append((sha, msg))
        # UI & Typography
        elif any(k in low for k in ["ui", "font", "nexa", "jakarta", "bento", "design", "css", "theme", "logo", "screen", "modal"]):
            categories["🎨 UI, Móvil y Tipografía"].append((sha, msg))
        # Bug Fixes
        elif any(k in low for k in ["fix", "bug", "patch", "repair", "resolv", "error", "crash", "missing"]):
            categories["🐛 Correcciones y Hardening"].append((sha, msg))
        # Features
        elif any(k in low for k in ["feat", "feature", "add", "implement", "support", "endpoint", "client", "adapter"]):
            categories["🚀 Funcionalidades y Mejoras"].append((sha, msg))
        # Infra / Maintenance
        else:
            categories["⚡ Infraestructura, CI/CD y Mantenimiento"].append((sha, msg))

    return categories


def generate_notes(version: str, version_code: str, output_path: Path, summary_path: Path) -> Tuple[str, str]:
    prev_tag = get_previous_tag()
    commits = get_commits_since_tag(prev_tag)
    categorized = categorize_commits(commits)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # 1. Full Markdown Release Notes
    md_lines = [
        f"## 📱 LastEdge Mobile v{version}",
        "",
        f"- **Versión:** `{version}`",
        f"- **Build Code:** `{version_code}`",
        f"- **Fecha de Compilación:** `{now_str}`",
        f"- **Firma:** Keystore de Producción (Soporta instalación directa / in-place update)",
        f"- **Tipografía Oficial:** Nexa (Títulos & Display) + Plus Jakarta Sans (Cuerpo & Métricas)",
        "",
        "### ⬇️ Descarga Directa del APK",
        f"Descarga el paquete [`LastEdge-v{version}.apk`](https://github.com/imlast999/lastedge-app/releases/download/v{version}/LastEdge-v{version}.apk) adjunto en esta release e instálalo directamente sobre tu app existente.",
        "",
        "---",
        "",
        "### 📋 Registro Semántico de Cambios",
        ""
    ]

    has_entries = False
    for cat_name, items in categorized.items():
        if items:
            has_entries = True
            md_lines.append(f"#### {cat_name}")
            for sha, msg in items:
                clean_msg = re.sub(r'^(feat|fix|chore|docs|refactor|perf|test|style|risk)(\([^)]+\))?:\s*', '', msg, flags=re.IGNORECASE)
                clean_msg = clean_msg[:1].upper() + clean_msg[1:]
                md_lines.append(f"- {clean_msg} (`{sha}`)")
            md_lines.append("")

    if not has_entries:
        md_lines.append("- Compilación y optimización periódica de producción con dependencias actualizadas.")
        md_lines.append("")

    md_lines.extend([
        "---",
        "",
        "> **Soporte de Actualización:** No se pierden datos, sesiones, pines biométricos ni configuraciones al instalar este APK sobre una versión previa."
    ])

    full_markdown = "\n".join(md_lines)
    output_path.write_text(full_markdown, encoding="utf-8")
    print(f"✅ Release notes escritas en: {output_path}")

    # 2. Concise Summary for Telegram / Discord
    summary_lines = []
    top_items = []
    for cat_name, items in categorized.items():
        for sha, msg in items[:2]:
            clean_msg = re.sub(r'^(feat|fix|chore|docs|refactor|perf|test|style|risk)(\([^)]+\))?:\s*', '', msg, flags=re.IGNORECASE)
            top_items.append(f"• {clean_msg[:75]}")
        if len(top_items) >= 5:
            break

    if top_items:
        summary_lines.extend(top_items[:5])
    else:
        summary_lines.append("• Compilación de producción optimizada y sincronizada.")

    summary_text = "\n".join(summary_lines)
    summary_path.write_text(summary_text, encoding="utf-8")
    print(f"✅ Resumen para bots escrito en: {summary_path}")

    return full_markdown, summary_text


def main():
    version = os.getenv("VERSION")
    version_code = os.getenv("VERSION_CODE", "1")

    # Read from VERSION file if not in env
    version_file = REPO_ROOT / "VERSION"
    if not version and version_file.exists():
        version = version_file.read_text(encoding="utf-8").strip()

    if not version:
        version = "1.1.0"

    output_path = REPO_ROOT / "release_notes.md"
    summary_path = REPO_ROOT / "release_summary.txt"

    generate_notes(version, version_code, output_path, summary_path)

    # Output to GitHub Actions environment
    gh_output = os.getenv("GITHUB_OUTPUT")
    if gh_output and os.path.exists(gh_output):
        with open(gh_output, "a", encoding="utf-8") as f:
            f.write(f"CHANGELOG_PATH={output_path}\n")
            f.write(f"SUMMARY_PATH={summary_path}\n")


if __name__ == "__main__":
    main()
