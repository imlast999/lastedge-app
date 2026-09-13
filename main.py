"""
LastEdge App — Main Entry Point
Inicia el Web Dashboard de LastEdge (puerto 8080).
"""

from __future__ import annotations

import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

from services.dashboard_server import start_dashboard_server


def main():
    print("=" * 65)
    print("🎨 LastEdge App — Web Dashboard Server")
    print("=" * 65)
    port = int(os.getenv("APP_PORT", "8080"))
    srv = start_dashboard_server(port=port)
    print(f"🌐 Web Dashboard disponible en: http://localhost:{port}")
    print("=" * 65)
    print("Presiona Ctrl+C para detener el servidor.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo Web Dashboard...")
        srv.stop()


if __name__ == "__main__":
    main()
