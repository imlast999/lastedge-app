"""
Clients Package — LastEdge App

HTTP REST Clients for decoupled communication with LastEdge Trading Engine and Strategy Lab.
"""

from .trading_client import (
    TradingClient,
    get_trading_client,
)

from .research_client import (
    ResearchClient,
    get_research_client,
)

__all__ = [
    "TradingClient",
    "get_trading_client",
    "ResearchClient",
    "get_research_client",
]
