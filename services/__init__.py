"""
Services Package — LastEdge App

Client layer, Web Dashboard server, notification adapters, and localization services.
"""

from .logging import (
    IntelligentLogger,
    get_intelligent_logger,
    log_event,
)

from .i18n import (
    translate,
    set_language,
    get_language,
    get_supported_languages,
)

from .notification_dispatcher import (
    NotificationDispatcher,
    get_notification_dispatcher,
)

from .clients import (
    TradingClient,
    get_trading_client,
    ResearchClient,
    get_research_client,
)

from .dashboard_server import (
    AppDashboardServer,
    get_dashboard_server,
    start_dashboard_server,
)

__all__ = [
    "IntelligentLogger",
    "get_intelligent_logger",
    "log_event",
    "translate",
    "get_language",
    "set_language",
    "get_supported_languages",
    "NotificationDispatcher",
    "get_notification_dispatcher",
    "TradingClient",
    "get_trading_client",
    "ResearchClient",
    "get_research_client",
    "AppDashboardServer",
    "get_dashboard_server",
    "start_dashboard_server",
]