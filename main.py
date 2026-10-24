"""
LastEdge App — Main Entry Point
Inicia el Web Dashboard, Gateway de la App Móvil y los Bots de Discord y Telegram.
"""

from __future__ import annotations

import os
import sys
import time
import socket
from datetime import datetime
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv()

from services.dashboard_server import start_dashboard_server
from services.bot_manager import start_bot_manager
from services.clients.trading_client import get_trading_client
from services.clients.research_client import get_research_client


def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    port = int(os.getenv("APP_PORT", "8080"))
    lan_ip = get_lan_ip()

    print("=" * 70)
    print("🎨 LastEdge App — Unified Control Center, Web Dashboard & Mobile Gateway")
    print("=" * 70)

    # 1. Iniciar Web Dashboard & Mobile API Gateway
    srv = start_dashboard_server(port=port)
    print(f"🌐 Web Dashboard Local:    http://localhost:{port}")
    print(f"📱 Mobile App Gateway:     http://{lan_ip}:{port} (LAN Wi-Fi)")
    print(f"                           http://10.0.2.2:{port} (Emulador Android)")

    # 2. Iniciar Bots de Discord y Telegram en background
    bot_mgr = start_bot_manager()
    status_bots = bot_mgr.get_status()

    discord_st = "🟢 Conectando..." if status_bots["discord"]["configured"] else "⚪ Standby (DISCORD_BOT_TOKEN no configurado)"
    telegram_st = "🟢 Conectando..." if status_bots["telegram"]["configured"] else "⚪ Standby (TELEGRAM_BOT_TOKEN no configurado)"

    print(f"🤖 Discord Bot:            {discord_st}")
    print(f"✈️  Telegram Bot:           {telegram_st}")

    # 3. Sondeo del Ecosistema
    trading_client = get_trading_client()
    research_client = get_research_client()

    t_online = trading_client.is_online()
    r_online = research_client.is_online()

    print(f"⚡ Trading Engine (:8081):  {'🟢 Conectado' if t_online else '🟡 Standby / Offline (iniciar con cli.py)'}")
    print(f"🔬 Strategy Lab   (:8082):  {'🟢 Conectado' if r_online else '🟡 Standby / Offline (iniciar con cli.py)'}")

    print("=" * 70)
    print("Presiona Ctrl+C para detener todos los servicios.\n")
    sys.stdout.flush()

    try:
        counter = 0
        while True:
            time.sleep(1)
            counter += 1
            if counter % 15 == 0:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                # Telemetría periódica
                t_stat = trading_client.get_status()
                eq_info = trading_client.get_equity().get("equity", {})
                bal = eq_info.get("balance", 0.0)
                pos_cnt = len(trading_client.get_positions().get("positions", []))
                engine_status = f"Bal: ${bal:.2f} | Pos: {pos_cnt}" if not t_stat.get("offline") else "Engine Offline"

                print(f"[{now_str}] [LastEdge App] 💓 Heartbeat OK | :8080 Activo | {engine_status}")
                sys.stdout.flush()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo LastEdge App y servicios asociados...")
        sys.stdout.flush()
        bot_mgr.stop()
        srv.stop()
        print("✅ Servicios detenidos correctamente.")


if __name__ == "__main__":
    main()
