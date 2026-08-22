"""
Internationalization (i18n) system for LastEdge.

Provides English and Spanish translations for all user-facing strings.
Default language is English. Language can be changed at runtime.

Usage:
    from core.i18n import _, set_language, get_language
    
    # Set language (default: 'en')
    set_language('es')  # or 'en'
    
    # Translate strings
    print(_("Signal detected"))  # "Señal detectada" in Spanish
    print(_("Win rate: {rate}%", rate=75.5))  # "Tasa de acierto: 75.5%"
"""

from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# ── Current language state ─────────────────────────────────────────────────────
_current_language: str = "en"  # 'en' or 'es'

# ── Translation dictionary ─────────────────────────────────────────────────────
# Keys are English strings (the source of truth).
# Values are dicts with language codes as keys.
_TRANSLATIONS: Dict[str, Dict[str, str]] = {}

def _t(key: str, lang: str) -> Optional[str]:
    """Look up a translation for a key in a language."""
    entry = _TRANSLATIONS.get(key)
    if entry is None:
        return None
    return entry.get(lang)


# ═══════════════════════════════════════════════════════════════════════════════
# TRANSLATIONS
# ═══════════════════════════════════════════════════════════════════════════════

# ── General / Status ───────────────────────────────────────────────────────────

_TRANSLATIONS["Not authorized"] = {
    "en": "⛔ Not authorized",
    "es": "⛔ No autorizado",
}
_TRANSLATIONS["Kill switch active. No signals generated."] = {
    "en": "⛔ Kill switch active. No signals generated.",
    "es": "⛔ Kill switch activado. No se generan señales.",
}
_TRANSLATIONS["Error connecting to MT5: {error}"] = {
    "en": "❌ Error connecting to MT5: {error}",
    "es": "❌ Error conectando a MT5: {error}",
}
_TRANSLATIONS["No valid signal"] = {
    "en": "❌ No valid signal",
    "es": "❌ No hay señal válida",
}
_TRANSLATIONS["Signal not found"] = {
    "en": "❌ Signal not found",
    "es": "❌ Señal no encontrada",
}
_TRANSLATIONS["Signal expired"] = {
    "en": "⌛ Signal expired",
    "es": "⌛ Señal expirada",
}
_TRANSLATIONS["Daily trade limit reached"] = {
    "en": "⛔ Daily trade limit reached",
    "es": "⛔ Límite de trades diarios alcanzado",
}
_TRANSLATIONS["Period limit reached ({current}/{max})"] = {
    "en": "⛔ Period limit reached ({current}/{max})",
    "es": "⛔ Límite de período alcanzado ({current}/{max})",
}
_TRANSLATIONS["Current period: {period} UTC"] = {
    "en": "📅 Current period: {period} UTC",
    "es": "📅 Período actual: {period} UTC",
}
_TRANSLATIONS["Next reset in: {hours:.1f}h"] = {
    "en": "⏰ Next reset in: {hours:.1f}h",
    "es": "⏰ Próximo reinicio: {hours:.1f}h",
}
_TRANSLATIONS["Signal accepted (ready for execution). Trades today: {count}/{max}"] = {
    "en": "✅ Signal accepted (ready for execution). Trades today: {count}/{max}",
    "es": "✅ Señal aceptada (lista para ejecución). Trades hoy: {count}/{max}",
}
_TRANSLATIONS["Signal {id} rejected"] = {
    "en": "❌ Signal {id} rejected",
    "es": "❌ Señal {id} rechazada",
}
_TRANSLATIONS["Result must be WIN, LOSS or BREAKEVEN"] = {
    "en": "❌ Result must be WIN, LOSS or BREAKEVEN",
    "es": "❌ Resultado debe ser WIN, LOSS o BREAKEVEN",
}
_TRANSLATIONS["Signal {id} closed: {result} | P&L: {pnl} EUR"] = {
    "en": "✅ Signal {id} closed: {result} | P&L: {pnl} EUR",
    "es": "✅ Señal {id} cerrada: {result} | P&L: {pnl} EUR",
}
_TRANSLATIONS["Signal {id} not found"] = {
    "en": "❌ Signal {id} not found",
    "es": "❌ No se encontró la señal {id}",
}
_TRANSLATIONS["Error closing signal: {error}"] = {
    "en": "❌ Error closing signal: {error}",
    "es": "❌ Error cerrando señal: {error}",
}
_TRANSLATIONS["No open positions"] = {
    "en": "(No open positions)",
    "es": "(Sin posiciones abiertas)",
}
_TRANSLATIONS["Open tickets: {count}"] = {
    "en": "Open tickets: {count}",
    "es": "Tickets abiertos: {count}",
}
_TRANSLATIONS["Close request submitted: {result}"] = {
    "en": "✅ Close request submitted: {result}",
    "es": "✅ Solicitud de cierre enviada: {result}",
}
_TRANSLATIONS["Error closing position: {error}"] = {
    "en": "❌ Error closing position: {error}",
    "es": "❌ Error cerrando posición: {error}",
}
_TRANSLATIONS["Error getting positions: {error}"] = {
    "en": "❌ Error getting positions: {error}",
    "es": "❌ Error obteniendo posiciones: {error}",
}
_TRANSLATIONS["Unsupported symbol: {symbol}"] = {
    "en": "Unsupported symbol: {symbol}",
    "es": "Símbolo no soportado: {symbol}",
}
_TRANSLATIONS["Timeframe not recognized: {tf}"] = {
    "en": "Timeframe not recognized: {tf}",
    "es": "Timeframe no reconocido: {tf}",
}
_TRANSLATIONS["Error getting data: {error}"] = {
    "en": "❌ Error getting data: {error}",
    "es": "❌ Error obteniendo datos: {error}",
}
_TRANSLATIONS["Current chart"] = {
    "en": "📊 Current chart",
    "es": "📊 Gráfico actual",
}
_TRANSLATIONS["Error generating chart: {error}"] = {
    "en": "❌ Error generating chart: {error}",
    "es": "❌ Error generando gráfico: {error}",
}
_TRANSLATIONS["Order executed: {result}"] = {
    "en": "✅ Order executed: {result}",
    "es": "✅ Orden ejecutada: {result}",
}
_TRANSLATIONS["Error executing order: {error}"] = {
    "en": "❌ Error executing order: {error}",
    "es": "❌ Error ejecutando orden: {error}",
}
_TRANSLATIONS["Could not calculate valid lot"] = {
    "en": "❌ Could not calculate valid lot",
    "es": "❌ No se pudo calcular un lot válido",
}
_TRANSLATIONS["Invalid parameters: {error}"] = {
    "en": "❌ Invalid parameters: {error}",
    "es": "❌ Parámetros inválidos: {error}",
}
_TRANSLATIONS["Action cancelled. Signal remains pending."] = {
    "en": "Action cancelled. Signal remains pending.",
    "es": "Acción cancelada. La señal permanece pendiente.",
}
_TRANSLATIONS["Select action: execute now, customize lot, or cancel."] = {
    "en": "Select action: execute now, customize lot, or cancel.",
    "es": "Selecciona acción: ejecutar ahora, personalizar lotaje o cancelar.",
}
_TRANSLATIONS["Confirm close"] = {
    "en": "Confirm close",
    "es": "Confirmar cierre",
}
_TRANSLATIONS["Cancel"] = {
    "en": "Cancel",
    "es": "Cancelar",
}
_TRANSLATIONS["Close position #{ticket}?"] = {
    "en": "Close position #{ticket}?",
    "es": "¿Cerrar posición #{ticket}?",
}
_TRANSLATIONS["Operation cancelled"] = {
    "en": "Operation cancelled",
    "es": "Operación cancelada",
}
_TRANSLATIONS["Select a position to close..."] = {
    "en": "Select a position to close...",
    "es": "Selecciona una posición a cerrar...",
}

# ── Autosignals ────────────────────────────────────────────────────────────────

_TRANSLATIONS["SIGNAL DETECTED (ID {id})"] = {
    "en": "🟡 **SIGNAL DETECTED** (ID {id})",
    "es": "🟡 **SEÑAL DETECTADA** (ID {id})",
}
_TRANSLATIONS["Symbol: {symbol}"] = {
    "en": "Symbol: {symbol}",
    "es": "Activo: {symbol}",
}
_TRANSLATIONS["Type: {type}"] = {
    "en": "Type: {type}",
    "es": "Tipo: {type}",
}
_TRANSLATIONS["Entry: {entry}"] = {
    "en": "Entry: {entry}",
    "es": "Entrada: {entry}",
}
_TRANSLATIONS["SL: {sl}"] = {
    "en": "SL: {sl}",
    "es": "SL: {sl}",
}
_TRANSLATIONS["TP: {tp}"] = {
    "en": "TP: {tp}",
    "es": "TP: {tp}",
}
_TRANSLATIONS["Valid for 1 minute"] = {
    "en": "⏱ Valid for 1 minute",
    "es": "⏱ Válida por 1 minuto",
}
_TRANSLATIONS["Explanation: {explanation}"] = {
    "en": "Explanation: {explanation}",
    "es": "Explicación: {explanation}",
}
_TRANSLATIONS["Suggested: {lot} lot"] = {
    "en": "Suggested: {lot} lot",
    "es": "Sugerido: {lot} lot",
}
_TRANSLATIONS["Risk approx: {amount} ({pct}%)"] = {
    "en": "Risk approx: {amount} ({pct}%)",
    "es": "Riesgo aprox: {amount} ({pct}%)",
}
_TRANSLATIONS["RR ≈ {rr}"] = {
    "en": "RR ≈ {rr}",
    "es": "RR ≈ {rr}",
}
_TRANSLATIONS["Accept"] = {
    "en": "Accept",
    "es": "Aceptar",
}
_TRANSLATIONS["Reject"] = {
    "en": "Reject",
    "es": "Rechazar",
}
_TRANSLATIONS["Execute now"] = {
    "en": "Execute now",
    "es": "Ejecutar ahora",
}
_TRANSLATIONS["Customize"] = {
    "en": "Customize",
    "es": "Personalizar",
}
_TRANSLATIONS["Autosignals is now {state}"] = {
    "en": "✅ Autosignals is now **{state}**",
    "es": "✅ Autosignals ahora está **{state}**",
}
_TRANSLATIONS["Autosignals is currently {state}"] = {
    "en": "🔍 Autosignals is currently **{state}**",
    "es": "🔍 Autosignals está actualmente **{state}**",
}
_TRANSLATIONS["ON"] = {"en": "ON", "es": "ACTIVADO"}
_TRANSLATIONS["OFF"] = {"en": "OFF", "es": "DESACTIVADO"}

# ── Language command ───────────────────────────────────────────────────────────

_TRANSLATIONS["Language changed to English"] = {
    "en": "🌐 Language changed to **English**",
    "es": "🌐 Idioma cambiado a **English**",
}
_TRANSLATIONS["Language changed to Spanish"] = {
    "en": "🌐 Language changed to **Spanish**",
    "es": "🌐 Idioma cambiado a **Español**",
}
_TRANSLATIONS["Current language: {lang}"] = {
    "en": "🌐 Current language: **{lang}**",
    "es": "🌐 Idioma actual: **{lang}**",
}
_TRANSLATIONS["English"] = {"en": "English", "es": "Inglés"}
_TRANSLATIONS["Spanish"] = {"en": "Spanish", "es": "Español"}
_TRANSLATIONS["Select language"] = {
    "en": "Select language",
    "es": "Seleccionar idioma",
}
_TRANSLATIONS["Set the bot language"] = {
    "en": "Set the bot language (English / Spanish)",
    "es": "Cambiar el idioma del bot (Inglés / Español)",
}

# ── Performance / Stats ────────────────────────────────────────────────────────

_TRANSLATIONS["PERFORMANCE REPORT ({days} days)"] = {
    "en": "📊 **PERFORMANCE REPORT ({days} days)**",
    "es": "📊 **REPORTE DE PERFORMANCE ({days} días)**",
}
_TRANSLATIONS["General Statistics:"] = {
    "en": "🔢 **General Statistics:**",
    "es": "🔢 **Estadísticas Generales:**",
}
_TRANSLATIONS["Total trades: {count}"] = {
    "en": "• Total trades: {count}",
    "es": "• Total de trades: {count}",
}
_TRANSLATIONS["Winning trades: {count}"] = {
    "en": "• Winning trades: {count}",
    "es": "• Trades ganadores: {count}",
}
_TRANSLATIONS["Losing trades: {count}"] = {
    "en": "• Losing trades: {count}",
    "es": "• Trades perdedores: {count}",
}
_TRANSLATIONS["Win rate: {rate}%"] = {
    "en": "• Win rate: {rate}%",
    "es": "• Tasa de acierto: {rate}%",
}
_TRANSLATIONS["Financial Results:"] = {
    "en": "💰 **Financial Results:**",
    "es": "💰 **Resultados Financieros:**",
}
_TRANSLATIONS["Total P&L: {pnl}"] = {
    "en": "• Total P&L: {pnl}",
    "es": "• PnL total: {pnl}",
}
_TRANSLATIONS["Average win: {avg}"] = {
    "en": "• Average win: {avg}",
    "es": "• Ganancia promedio: {avg}",
}
_TRANSLATIONS["Average loss: {avg}"] = {
    "en": "• Average loss: {avg}",
    "es": "• Pérdida promedio: {avg}",
}
_TRANSLATIONS["Profit factor: {pf}"] = {
    "en": "• Profit factor: {pf}",
    "es": "• Factor de beneficio: {pf}",
}
_TRANSLATIONS["Analysis:"] = {
    "en": "📈 **Analysis:**",
    "es": "📈 **Análisis:**",
}
_TRANSLATIONS["Excellent win rate"] = {
    "en": "✅ Excellent win rate",
    "es": "✅ Excelente tasa de acierto",
}
_TRANSLATIONS["Acceptable win rate"] = {
    "en": "🟡 Acceptable win rate",
    "es": "🟡 Tasa de acierto aceptable",
}
_TRANSLATIONS["Low win rate - review strategies"] = {
    "en": "🔴 Low win rate - review strategies",
    "es": "🔴 Tasa de acierto baja - revisar estrategias",
}
_TRANSLATIONS["Good profit factor"] = {
    "en": "✅ Good profit factor",
    "es": "✅ Buen factor de beneficio",
}
_TRANSLATIONS["Marginal profit factor"] = {
    "en": "🟡 Marginal profit factor",
    "es": "🟡 Factor de beneficio marginal",
}
_TRANSLATIONS["Negative profit factor"] = {
    "en": "🔴 Negative profit factor",
    "es": "🔴 Factor de beneficio negativo",
}
_TRANSLATIONS["Risk manager not available"] = {
    "en": "❌ Risk manager not available",
    "es": "❌ Gestor de riesgo no disponible",
}
_TRANSLATIONS["No data for selected period"] = {
    "en": "❌ No data for selected period",
    "es": "❌ No hay datos en el período seleccionado",
}

# ── Strategy Performance ───────────────────────────────────────────────────────

_TRANSLATIONS["STRATEGY PERFORMANCE ({days} days)"] = {
    "en": "📊 **STRATEGY PERFORMANCE ({days} days)**",
    "es": "📊 **PERFORMANCE POR ESTRATEGIA ({days} días)**",
}
_TRANSLATIONS["Trades: {total} | Wins: {wins} | Losses: {losses}"] = {
    "en": "• Trades: {total} | Wins: {wins} | Losses: {losses}",
    "es": "• Trades: {total} | Ganadores: {wins} | Perdedores: {losses}",
}
_TRANSLATIONS["Average win: {avg}"] = {
    "en": "• Average win: {avg}",
    "es": "• Ganancia promedio: {avg}",
}
_TRANSLATIONS["Average loss: {avg}"] = {
    "en": "• Average loss: {avg}",
    "es": "• Pérdida promedio: {avg}",
}

# ── Debug / Diagnose ───────────────────────────────────────────────────────────

_TRANSLATIONS["SIGNAL DIAGNOSTIC - {symbol}"] = {
    "en": "🔍 **SIGNAL DIAGNOSTIC - {symbol}**",
    "es": "🔍 **DIAGNÓSTICO DE SEÑALES - {symbol}**",
}
_TRANSLATIONS["Configuration:"] = {
    "en": "**Configuration:**",
    "es": "**Configuración:**",
}
_TRANSLATIONS["Strategy: `{strategy}`"] = {
    "en": "- Strategy: `{strategy}`",
    "es": "- Estrategia: `{strategy}`",
}
_TRANSLATIONS["Min Score: `{score}`"] = {
    "en": "- Min Score: `{score}`",
    "es": "- Min Score: `{score}`",
}
_TRANSLATIONS["Windows analyzed: `{count}`"] = {
    "en": "- Windows analyzed: `{count}`",
    "es": "- Ventanas analizadas: `{count}`",
}
_TRANSLATIONS["Lookback: `{lookback} candles`"] = {
    "en": "- Lookback: `{lookback} candles`",
    "es": "- Lookback: `{lookback} velas`",
}
_TRANSLATIONS["Historical Window Analysis:"] = {
    "en": "**Historical Window Analysis:**",
    "es": "**Análisis de Ventanas Históricas:**",
}
_TRANSLATIONS["Total evaluated: `{count}` distinct windows"] = {
    "en": "- Total evaluated: `{count}` distinct windows",
    "es": "- Total evaluado: `{count}` ventanas distintas",
}
_TRANSLATIONS["Setup detected: `{count}` ({pct:.1f}%)"] = {
    "en": "- Setup detected: `{count}` ({pct:.1f}%)",
    "es": "- Setup detectado: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["Passed scoring: `{count}` ({pct:.1f}%)"] = {
    "en": "- Passed scoring: `{count}` ({pct:.1f}%)",
    "es": "- Pasó scoring: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["High confidence: `{count}` ({pct:.1f}%)"] = {
    "en": "- High confidence: `{count}` ({pct:.1f}%)",
    "es": "- Alta confianza: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["Final signals: `{count}` ({pct:.1f}%)"] = {
    "en": "- Final signals: `{count}` ({pct:.1f}%)",
    "es": "- Señales finales: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["Signal Breakdown:"] = {
    "en": "**Signal Breakdown:**",
    "es": "**Desglose de Señales:**",
}
_TRANSLATIONS["BUY: `{count}` ({pct:.1f}%)"] = {
    "en": "- BUY: `{count}` ({pct:.1f}%)",
    "es": "- BUY: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["SELL: `{count}` ({pct:.1f}%)"] = {
    "en": "- SELL: `{count}` ({pct:.1f}%)",
    "es": "- SELL: `{count}` ({pct:.1f}%)",
}
_TRANSLATIONS["Confidence Distribution:"] = {
    "en": "**Confidence Distribution:**",
    "es": "**Distribución de Confianza:**",
}
_TRANSLATIONS["Interpretation:"] = {
    "en": "**Interpretation:**",
    "es": "**Interpretación:**",
}
_TRANSLATIONS["No final signals detected in {count} historical windows."] = {
    "en": "⚠️ No final signals detected in {count} historical windows.",
    "es": "⚠️ No se detectaron señales finales en {count} ventanas históricas.",
}
_TRANSLATIONS["Possible causes:"] = {
    "en": "Possible causes:",
    "es": "Posibles causas:",
}
_TRANSLATIONS["Strategy too restrictive"] = {
    "en": "- Strategy too restrictive",
    "es": "- Estrategia demasiado restrictiva",
}
_TRANSLATIONS["Market conditions not favorable in the period"] = {
    "en": "- Market conditions not favorable in the period",
    "es": "- Condiciones de mercado no favorables en el período",
}
_TRANSLATIONS["Min score too high ({score})"] = {
    "en": "- Min score too high ({score})",
    "es": "- Min score muy alto ({score})",
}
_TRANSLATIONS["Very low signal rate ({pct:.2f}%)"] = {
    "en": "⚠️ Very low signal rate ({pct:.2f}%)",
    "es": "⚠️ Tasa de señales muy baja ({pct:.2f}%)",
}
_TRANSLATIONS["The strategy is extremely selective."] = {
    "en": "The strategy is extremely selective.",
    "es": "La estrategia es extremadamente selectiva.",
}
_TRANSLATIONS["Very high signal rate ({pct:.1f}%)"] = {
    "en": "⚠️ Very high signal rate ({pct:.1f}%)",
    "es": "⚠️ Tasa de señales muy alta ({pct:.1f}%)",
}
_TRANSLATIONS["Overtrading risk. Consider increasing filters."] = {
    "en": "Overtrading risk. Consider increasing filters.",
    "es": "Riesgo de sobretrading. Considerar aumentar filtros.",
}
_TRANSLATIONS["Signal rate in optimal range ({pct:.1f}%)"] = {
    "en": "✅ Signal rate in optimal range ({pct:.1f}%)",
    "es": "✅ Tasa de señales en rango óptimo ({pct:.1f}%)",
}
_TRANSLATIONS["Execution time: `{time:.2f}s`"] = {
    "en": "Execution time: `{time:.2f}s`",
    "es": "Tiempo de ejecución: `{time:.2f}s`",
}

# ── Debug Signals ──────────────────────────────────────────────────────────────

_TRANSLATIONS["Signal Debug: {symbol}"] = {
    "en": "🔍 Signal Debug: {symbol}",
    "es": "🔍 Debug de Señales: {symbol}",
}
_TRANSLATIONS["Full pipeline analysis (engine + scoring + filters)"] = {
    "en": "Full pipeline analysis (engine + scoring + filters)",
    "es": "Análisis con pipeline completo (engine + scoring + filtros)",
}
_TRANSLATIONS["Basic Data"] = {
    "en": "📊 **Basic Data**",
    "es": "📊 **Datos Básicos**",
}
_TRANSLATIONS["Symbol: {symbol}"] = {
    "en": "**Symbol:** {symbol}",
    "es": "**Símbolo:** {symbol}",
}
_TRANSLATIONS["Candles: {count}"] = {
    "en": "**Candles:** {count}",
    "es": "**Velas:** {count}",
}
_TRANSLATIONS["Price: {price}"] = {
    "en": "**Price:** {price}",
    "es": "**Precio:** {price}",
}
_TRANSLATIONS["Full Pipeline"] = {
    "en": "🎯 **Full Pipeline**",
    "es": "🎯 **Pipeline Completo**",
}
_TRANSLATIONS["Signal: DETECTED"] = {
    "en": "**Signal:** ✅ DETECTED",
    "es": "**Señal:** ✅ DETECTADA",
}
_TRANSLATIONS["Signal: NOT DETECTED"] = {
    "en": "**Signal:** ❌ NOT DETECTED",
    "es": "**Señal:** ❌ NO DETECTADA",
}
_TRANSLATIONS["Confidence: {confidence}"] = {
    "en": "**Confidence:** {confidence}",
    "es": "**Confianza:** {confidence}",
}
_TRANSLATIONS["Score: {score:.2f}"] = {
    "en": "**Score:** {score:.2f}",
    "es": "**Score:** {score:.2f}",
}
_TRANSLATIONS["Show: YES"] = {
    "en": "**Show:** ✅ YES",
    "es": "**Mostrar:** ✅ SÍ",
}
_TRANSLATIONS["Show: NO"] = {
    "en": "**Show:** ❌ NO",
    "es": "**Mostrar:** ❌ NO",
}
_TRANSLATIONS["Evaluation"] = {
    "en": "🔧 **Evaluation**",
    "es": "🔧 **Evaluación**",
}
_TRANSLATIONS["Engine: EXECUTED"] = {
    "en": "**Engine:** ✅ EXECUTED",
    "es": "**Engine:** ✅ EJECUTADO",
}
_TRANSLATIONS["Engine: NO"] = {
    "en": "**Engine:** ❌ NO",
    "es": "**Engine:** ❌ NO",
}
_TRANSLATIONS["Auto-exec: YES"] = {
    "en": "**Auto-exec:** ✅ YES",
    "es": "**Auto-exec:** ✅ SÍ",
}
_TRANSLATIONS["Auto-exec: NO"] = {
    "en": "**Auto-exec:** ❌ NO",
    "es": "**Auto-exec:** ❌ NO",
}
_TRANSLATIONS["Approved: YES"] = {
    "en": "**Approved:** ✅ YES",
    "es": "**Aprobado:** ✅ SÍ",
}
_TRANSLATIONS["Approved: NO"] = {
    "en": "**Approved:** ❌ NO",
    "es": "**Aprobado:** ❌ NO",
}
_TRANSLATIONS["Signal Generated"] = {
    "en": "✅ **Signal Generated**",
    "es": "✅ **Señal Generada**",
}
_TRANSLATIONS["Rejection Reason"] = {
    "en": "❌ **Rejection Reason**",
    "es": "❌ **Razón de Rechazo**",
}
_TRANSLATIONS["Engine Details"] = {
    "en": "🔍 **Engine Details**",
    "es": "🔍 **Detalles del Engine**",
}
_TRANSLATIONS["Setup: YES"] = {
    "en": "**Setup:** ✅",
    "es": "**Setup:** ✅",
}
_TRANSLATIONS["Setup: NO"] = {
    "en": "**Setup:** ❌",
    "es": "**Setup:** ❌",
}
_TRANSLATIONS["Confirmations: {passed}/{total}"] = {
    "en": "**Confirmations:** {passed}/{total}",
    "es": "**Confirmaciones:** {passed}/{total}",
}
_TRANSLATIONS["Filters: PASSED"] = {
    "en": "**Filters:** ✅ PASSED",
    "es": "**Filtros:** ✅ PASADOS",
}
_TRANSLATIONS["Filters: FAILED"] = {
    "en": "**Filters:** ❌ FAILED",
    "es": "**Filtros:** ❌ FALLADOS",
}
_TRANSLATIONS["Configuration"] = {
    "en": "⚙️ **Configuration**",
    "es": "⚙️ **Configuración**",
}
_TRANSLATIONS["Min Score: {score}"] = {
    "en": "**Min Score:** {score}",
    "es": "**Min Score:** {score}",
}
_TRANSLATIONS["Min R:R: {rr}"] = {
    "en": "**Min R:R:** {rr}",
    "es": "**Min R:R:** {rr}",
}
_TRANSLATIONS["Enabled: {enabled}"] = {
    "en": "**Enabled:** {enabled}",
    "es": "**Habilitado:** {enabled}",
}
_TRANSLATIONS["Diagnosis"] = {
    "en": "💡 **Diagnosis**",
    "es": "💡 **Diagnóstico**",
}
_TRANSLATIONS["Valid signal generated successfully"] = {
    "en": "✅ Valid signal generated successfully",
    "es": "✅ Señal válida generada correctamente",
}
_TRANSLATIONS["Check logs for detailed rejections"] = {
    "en": "• Check logs for detailed rejections",
    "es": "• Revisa logs para ver rechazos detallados",
}
_TRANSLATIONS["Verify symbol is active"] = {
    "en": "• Verify symbol is active",
    "es": "• Verifica que el símbolo esté activo",
}
_TRANSLATIONS["Check market conditions"] = {
    "en": "• Check market conditions",
    "es": "• Comprueba condiciones de mercado",
}

# ── Weekly Summary ─────────────────────────────────────────────────────────────

_TRANSLATIONS["Weekly Summary — Trading Bot"] = {
    "en": "📊 Weekly Summary — LastEdge",
    "es": "📊 Resumen Semanal — LastEdge",
}
_TRANSLATIONS["Week of {start} to {end}"] = {
    "en": "Week of {start} to {end}",
    "es": "Semana del {start} al {end}",
}
_TRANSLATIONS["Total signals"] = {
    "en": "📈 Total signals",
    "es": "📈 Señales totales",
}
_TRANSLATIONS["Wins"] = {
    "en": "✅ Wins",
    "es": "✅ Wins",
}
_TRANSLATIONS["Losses"] = {
    "en": "❌ Losses",
    "es": "❌ Losses",
}
_TRANSLATIONS["Winrate"] = {
    "en": "🎯 Winrate",
    "es": "🎯 Winrate",
}
_TRANSLATIONS["Best pair"] = {
    "en": "🏆 Best pair",
    "es": "🏆 Mejor par",
}
_TRANSLATIONS["Worst pair"] = {
    "en": "📉 Worst pair",
    "es": "📉 Peor par",
}

# ── Market Opening ─────────────────────────────────────────────────────────────

_TRANSLATIONS["PRE-MARKET ALERT {market}"] = {
    "en": "🚨 **PRE-MARKET ALERT {market}**",
    "es": "🚨 **ALERTA PRE-MERCADO {market}**",
}
_TRANSLATIONS["Opening in ~30 minutes"] = {
    "en": "⏰ Opening in ~30 minutes",
    "es": "⏰ Apertura en ~30 minutos",
}
_TRANSLATIONS["IMMINENT OPENING {market}"] = {
    "en": "🔥 **IMMINENT OPENING {market}**",
    "es": "🔥 **APERTURA INMINENTE {market}**",
}
_TRANSLATIONS["Opening in ~15 minutes - Get ready!"] = {
    "en": "⚡ Opening in ~15 minutes - Get ready!",
    "es": "⚡ Apertura en ~15 minutos - ¡Prepárate!",
}
_TRANSLATIONS["MARKET OPEN {market}"] = {
    "en": "📊 **MARKET OPEN {market}**",
    "es": "📊 **MERCADO ABIERTO {market}**",
}
_TRANSLATIONS["First movements detected"] = {
    "en": "🎯 First movements detected",
    "es": "🎯 Primeros movimientos detectados",
}
_TRANSLATIONS["Spain time: {time} | GMT: {gmt}"] = {
    "en": "🕐 **Spain time:** {time} | GMT: {gmt}",
    "es": "🕐 **Hora España:** {time} | GMT: {gmt}",
}
_TRANSLATIONS["OPPORTUNITIES DETECTED:"] = {
    "en": "🎯 **OPPORTUNITIES DETECTED:**",
    "es": "🎯 **OPORTUNIDADES DETECTADAS:**",
}
_TRANSLATIONS["No clear opportunities detected"] = {
    "en": "📊 **No clear opportunities detected**",
    "es": "📊 **Sin oportunidades claras detectadas**",
}
_TRANSLATIONS["Wait for post-opening confirmation"] = {
    "en": "⏳ Wait for post-opening confirmation",
    "es": "⏳ Esperar confirmación post-apertura",
}
_TRANSLATIONS["Opening Tips:"] = {
    "en": "💡 **Opening Tips:**",
    "es": "💡 **Consejos para Apertura:**",
}
_TRANSLATIONS["Wait for direction confirmation"] = {
    "en": "• Wait for direction confirmation",
    "es": "• Espera confirmación de dirección",
}
_TRANSLATIONS["Use wider stops due to volatility"] = {
    "en": "• Use wider stops due to volatility",
    "es": "• Usa stops más amplios por volatilidad",
}
_TRANSLATIONS["Consider volume in first 30 min"] = {
    "en": "• Consider volume in first 30 min",
    "es": "• Considera volumen en primeros 30 min",
}
_TRANSLATIONS["Stay alert for news"] = {
    "en": "• Stay alert for news",
    "es": "• Mantente alerta a noticias",
}

# ── Session Summary ────────────────────────────────────────────────────────────

_TRANSLATIONS["Summary — {session}"] = {
    "en": "{emoji} **Summary — {session}**",
    "es": "{emoji} **Resumen — {session}**",
}
_TRANSLATIONS["Close: {time} UTC | {date}"] = {
    "en": "🕐 Close: {time} UTC | {date}",
    "es": "🕐 Cierre: {time} UTC | {date}",
}
_TRANSLATIONS["No signals in this session."] = {
    "en": "📊 No signals in this session.",
    "es": "📊 Sin señales en esta sesión.",
}
_TRANSLATIONS["Signals generated: {count}"] = {
    "en": "📈 **Signals generated:** {count}",
    "es": "📈 **Señales generadas:** {count}",
}
_TRANSLATIONS["Closed: {closed} ({wins}W / {losses}L)"] = {
    "en": "✅ Closed: {closed} ({wins}W / {losses}L)",
    "es": "✅ Cerradas: {closed} ({wins}W / {losses}L)",
}
_TRANSLATIONS["Pending: {count}"] = {
    "en": "⏳ Pending: {count}",
    "es": "⏳ Pendientes: {count}",
}
_TRANSLATIONS["By pair:"] = {
    "en": "**By pair:**",
    "es": "**Por par:**",
}
_TRANSLATIONS["Next session: {name}"] = {
    "en": "_Next session: {name}_",
    "es": "_Próxima sesión: {name}_",
}

# ── Dashboard ──────────────────────────────────────────────────────────────────

_TRANSLATIONS["Connected"] = {
    "en": "🟢 Connected",
    "es": "🟢 Conectado",
}
_TRANSLATIONS["{min}m without data"] = {
    "en": "🟡 {min}m without data",
    "es": "🟡 {min}m sin datos",
}
_TRANSLATIONS["{min}m without data (red)"] = {
    "en": "🔴 {min}m without data",
    "es": "🔴 {min}m sin datos",
}
_TRANSLATIONS["No data"] = {
    "en": "— No data",
    "es": "— Sin datos",
}
_TRANSLATIONS["No signals in this session yet"] = {
    "en": "No signals in this session yet",
    "es": "Sin señales en esta sesión aún",
}
_TRANSLATIONS["Open Positions in MT5"] = {
    "en": "Open Positions in MT5",
    "es": "Posiciones Abiertas en MT5",
}
_TRANSLATIONS["Pair"] = {
    "en": "Pair",
    "es": "Par",
}
_TRANSLATIONS["Dir"] = {
    "en": "Dir",
    "es": "Dir",
}
_TRANSLATIONS["Volume"] = {
    "en": "Volume",
    "es": "Volumen",
}
_TRANSLATIONS["Open price"] = {
    "en": "Open price",
    "es": "Precio apertura",
}
_TRANSLATIONS["Current price"] = {
    "en": "Current price",
    "es": "Precio actual",
}
_TRANSLATIONS["Status"] = {
    "en": "Status",
    "es": "Estado",
}
_TRANSLATIONS["Signals (session)"] = {
    "en": "Signals (session)",
    "es": "Señales (sesión)",
}
_TRANSLATIONS["Shown: {count} ({rate})"] = {
    "en": "Shown: {count} ({rate})",
    "es": "Mostradas: {count} ({rate})",
}
_TRANSLATIONS["Open positions"] = {
    "en": "Open positions",
    "es": "Posiciones abiertas",
}
_TRANSLATIONS["Last signal: {time}"] = {
    "en": "Last signal: {time}",
    "es": "Última señal: {time}",
}
_TRANSLATIONS["Total profit"] = {
    "en": "Total profit",
    "es": "Profit total",
}
_TRANSLATIONS["MT5 Account"] = {
    "en": "MT5 Account",
    "es": "Cuenta MT5",
}
_TRANSLATIONS["Real-time Equity"] = {
    "en": "Real-time Equity",
    "es": "Equity (tiempo real)",
}
_TRANSLATIONS["Base: {base}"] = {
    "en": "Base: {base}",
    "es": "Base: {base}",
}
_TRANSLATIONS["Closed: {pnl}"] = {
    "en": "Closed: {pnl}",
    "es": "Cerradas: {pnl}",
}
_TRANSLATIONS["Floating: {pnl}"] = {
    "en": "Floating: {pnl}",
    "es": "Flotante: {pnl}",
}
_TRANSLATIONS["({count} open)"] = {
    "en": "({count} open)",
    "es": "({count} abiertas)",
}
_TRANSLATIONS["Session winrate"] = {
    "en": "Session winrate",
    "es": "Winrate sesión",
}
_TRANSLATIONS["{wins} wins · {losses} losses · {open} open"] = {
    "en": "✅ {wins} wins · ❌ {losses} losses · ⏳ {open} open",
    "es": "✅ {wins} wins · ❌ {losses} losses · ⏳ {open} abiertas",
}
_TRANSLATIONS["Export signals (7 days)"] = {
    "en": "Export signals (7 days)",
    "es": "Exportar señales (7 días)",
}
_TRANSLATIONS["Download CSV"] = {
    "en": "⬇ Download CSV",
    "es": "⬇ Descargar CSV",
}
_TRANSLATIONS["{count} signals in history"] = {
    "en": "{count} signals in history",
    "es": "{count} señales en historial",
}
_TRANSLATIONS["Equity Curve — closed + current floating"] = {
    "en": "Equity Curve — closed + current floating",
    "es": "Curva de Equity — cerradas + flotante actual",
}
_TRANSLATIONS["Circuit Breaker"] = {
    "en": "Circuit Breaker",
    "es": "Circuit Breaker",
}
_TRANSLATIONS["Losses: {count}"] = {
    "en": "Losses: {count}",
    "es": "Pérdidas: {count}",
}
_TRANSLATIONS["Wins: {count}"] = {
    "en": "Wins: {count}",
    "es": "Wins: {count}",
}
_TRANSLATIONS["Risk ×{mult}"] = {
    "en": "Risk ×{mult}",
    "es": "Riesgo ×{mult}",
}
_TRANSLATIONS["Monitored Pairs"] = {
    "en": "Monitored Pairs",
    "es": "Pares monitoreados",
}
_TRANSLATIONS["Total"] = {
    "en": "Total",
    "es": "Total",
}
_TRANSLATIONS["Shown"] = {
    "en": "Shown",
    "es": "Mostradas",
}
_TRANSLATIONS["Score avg"] = {
    "en": "Score avg",
    "es": "Score avg",
}
_TRANSLATIONS["Last"] = {
    "en": "Last",
    "es": "Última",
}
_TRANSLATIONS["Session signals (real-time P&L)"] = {
    "en": "Session signals (real-time P&L)",
    "es": "Señales de esta sesión (P&L en tiempo real)",
}
_TRANSLATIONS["Time"] = {
    "en": "Time",
    "es": "Hora",
}
_TRANSLATIONS["Confidence"] = {
    "en": "Confidence",
    "es": "Confianza",
}
_TRANSLATIONS["Sent"] = {
    "en": "Sent",
    "es": "Enviada",
}
_TRANSLATIONS["Auto-execution active"] = {
    "en": "✅ Auto-execution active",
    "es": "✅ Auto-ejecución activa",
}
_TRANSLATIONS["Auto-execution disabled (AUTO_EXECUTE_SIGNALS=0)"] = {
    "en": "⏸ Auto-execution disabled (AUTO_EXECUTE_SIGNALS=0)",
    "es": "⏸ Auto-ejecución desactivada (AUTO_EXECUTE_SIGNALS=0)",
}
_TRANSLATIONS["Start"] = {
    "en": "Start",
    "es": "Inicio",
}
_TRANSLATIONS["Live · updates every 30s"] = {
    "en": "Live · updates every 30s",
    "es": "En vivo · actualiza cada 30s",
}
_TRANSLATIONS["Last 24h · Update every 5s"] = {
    "en": "Last 24h · Update every 5s",
    "es": "Últimas 24h · Actualización cada 5s",
}
_TRANSLATIONS["ACTIVE"] = {
    "en": "ACTIVE",
    "es": "ACTIVO",
}
_TRANSLATIONS["PAUSED"] = {
    "en": "PAUSED",
    "es": "PAUSADO",
}

# ── MT5 Credentials ────────────────────────────────────────────────────────────

_TRANSLATIONS["MT5 credentials saved and encrypted to disk. Use `mt5_login` to log in."] = {
    "en": "MT5 credentials saved and encrypted to disk. Use `mt5_login` to log in.",
    "es": "Credenciales MT5 almacenadas y cifradas en disco. Usa `mt5_login` para iniciar sesión.",
}
_TRANSLATIONS["Credentials stored in memory (not encrypted). Set MT5_MASTER_KEY in .env to encrypt to disk."] = {
    "en": "Credentials stored in memory (not encrypted). Set MT5_MASTER_KEY in .env to encrypt to disk.",
    "es": "Credenciales almacenadas en memoria (no cifradas). Define MT5_MASTER_KEY en .env para cifrarlas.",
}
_TRANSLATIONS["No credentials saved. Use `set_mt5_credentials` first."] = {
    "en": "No credentials saved. Use `set_mt5_credentials` first.",
    "es": "No hay credenciales guardadas. Usa `set_mt5_credentials` primero.",
}
_TRANSLATIONS["Connected and logged in to MT5."] = {
    "en": "✅ Connected and logged in to MT5.",
    "es": "✅ Conectado y logueado en MT5.",
}
_TRANSLATIONS["Login failed: {error}"] = {
    "en": "❌ Login failed: {error}",
    "es": "❌ Login falló: {error}",
}
_TRANSLATIONS["Error logging into MT5: {error}"] = {
    "en": "❌ Error logging into MT5: {error}",
    "es": "❌ Error al loguear en MT5: {error}",
}

# ── Strategy Config ────────────────────────────────────────────────────────────

_TRANSLATIONS["Strategy Updated"] = {
    "en": "✅ Strategy Updated",
    "es": "✅ Estrategia Actualizada",
}
_TRANSLATIONS["Configuration changed for {symbol}"] = {
    "en": "Configuration changed for **{symbol}**",
    "es": "Configuración cambiada para **{symbol}**",
}
_TRANSLATIONS["Previous strategy: `{strategy}`"] = {
    "en": "**Previous strategy:** `{strategy}`",
    "es": "**Estrategia anterior:** `{strategy}`",
}
_TRANSLATIONS["New strategy: `{strategy}`"] = {
    "en": "**New strategy:** `{strategy}`",
    "es": "**Nueva estrategia:** `{strategy}`",
}
_TRANSLATIONS["Active"] = {
    "en": "🟢 Active",
    "es": "🟢 Activo",
}
_TRANSLATIONS["Inactive"] = {
    "en": "🔴 Inactive",
    "es": "🔴 Inactivo",
}
_TRANSLATIONS["Changes will apply on next auto signal"] = {
    "en": "Changes will apply on next auto signal",
    "es": "Los cambios se aplicarán en la próxima señal automática",
}
_TRANSLATIONS["Error saving configuration: {error}"] = {
    "en": "❌ Error saving configuration: {error}",
    "es": "❌ Error guardando configuración: {error}",
}
_TRANSLATIONS["Only main pairs can be configured: {pairs}"] = {
    "en": "❌ Only main pairs can be configured: {pairs}",
    "es": "❌ Solo se pueden configurar los pares principales: {pairs}",
}

# ── Forced Signal ──────────────────────────────────────────────────────────────

_TRANSLATIONS["FORCED SIGNAL (ID {id})"] = {
    "en": "🔧 **FORCED SIGNAL** (ID {id})",
    "es": "🔧 **SEÑAL FORZADA** (ID {id})",
}
_TRANSLATIONS["Risk Information:"] = {
    "en": "**Risk Information:**",
    "es": "**Información de Riesgo:**",
}
_TRANSLATIONS["Suggested lot: {lot}"] = {
    "en": "Suggested lot: {lot}",
    "es": "Lot sugerido: {lot}",
}
_TRANSLATIONS["R:R: {rr}"] = {
    "en": "R:R: {rr}",
    "es": "R:R: {rr}",
}
_TRANSLATIONS["Forced signal sent to channel #{channel}"] = {
    "en": "✅ Forced signal sent to channel #{channel}",
    "es": "✅ Señal forzada enviada al canal #{channel}",
}
_TRANSLATIONS["Signal sent (no chart): {error}"] = {
    "en": "✅ Signal sent (no chart): {error}",
    "es": "✅ Señal enviada (sin gráfico): {error}",
}
_TRANSLATIONS["Could not generate signal: {reason}"] = {
    "en": "❌ Could not generate signal: {reason}",
    "es": "❌ No se pudo generar señal: {reason}",
}
_TRANSLATIONS["Error forcing signal: {error}"] = {
    "en": "❌ Error forcing signal: {error}",
    "es": "❌ Error forzando señal: {error}",
}
_TRANSLATIONS["Channel '{channel}' not found. Create it first."] = {
    "en": "❌ Channel '{channel}' not found. Create it first.",
    "es": "❌ No se encontró el canal '{channel}'. Créalo primero.",
}

# ── Backtest ───────────────────────────────────────────────────────────────────

_TRANSLATIONS["Processing remote backtest ID {id} ({symbol} - {strategy})"] = {
    "en": "🔄 Processing remote backtest ID {id} ({symbol} - {strategy})",
    "es": "🔄 Procesando backtest remoto ID {id} ({symbol} - {strategy})",
}
_TRANSLATIONS["Remote backtest ID {id} processed successfully"] = {
    "en": "✅ Remote backtest ID {id} processed successfully",
    "es": "✅ Backtest remoto ID {id} procesado exitosamente",
}
_TRANSLATIONS["Remote backtest ID {id} failed"] = {
    "en": "❌ Remote backtest ID {id} failed",
    "es": "❌ Falló el backtest remoto ID {id}",
}

# ── News Filter ────────────────────────────────────────────────────────────────

_TRANSLATIONS["News blackout active for {symbol}"] = {
    "en": "📰 News blackout active for {symbol}",
    "es": "📰 Blackout de noticias activo para {symbol}",
}
_TRANSLATIONS["Next high-impact event: {event} at {time} UTC"] = {
    "en": "📰 Next high-impact event: {event} at {time} UTC",
    "es": "📰 Próximo evento de alto impacto: {event} a las {time} UTC",
}

# ── Logging / Events ───────────────────────────────────────────────────────────

_TRANSLATIONS["NEW PERIOD: {period} UTC | Trades reset: {old} → 0"] = {
    "en": "🔄 NEW PERIOD: {period} UTC | Trades reset: {old} → 0",
    "es": "🔄 NUEVO PERÍODO: {period} UTC | Trades resetados: {old} → 0",
}
_TRANSLATIONS["COMMAND: /{command} {args} | User: {user}"] = {
    "en": "🎮 COMMAND: /{command} {args} | User: {user}",
    "es": "🎮 COMMAND: /{command} {args} | User: {user}",
}
_TRANSLATIONS["COMMAND SUCCESS: /{command} {args}"] = {
    "en": "✅ COMMAND SUCCESS: /{command} {args}",
    "es": "✅ COMMAND SUCCESS: /{command} {args}",
}
_TRANSLATIONS["COMMAND ERROR: /{command} {args} | Error: {error}"] = {
    "en": "❌ COMMAND ERROR: /{command} {args} | Error: {error}",
    "es": "❌ COMMAND ERROR: /{command} {args} | Error: {error}",
}
_TRANSLATIONS["COMMAND REJECTED: /{command} | User: {user} | Reason: Not authorized"] = {
    "en": "❌ COMMAND REJECTED: /{command} | User: {user} | Reason: Not authorized",
    "es": "❌ COMMAND REJECTED: /{command} | User: {user} | Reason: No autorizado",
}
_TRANSLATIONS["COMMAND REJECTED: /{command} | Symbol: {symbol} | Reason: Unsupported symbol"] = {
    "en": "❌ COMMAND REJECTED: /{command} | Symbol: {symbol} | Reason: Unsupported symbol",
    "es": "❌ COMMAND REJECTED: /{command} | Symbol: {symbol} | Reason: Símbolo no soportado",
}

# ── MT5 Watchdog ───────────────────────────────────────────────────────────────

_TRANSLATIONS["MT5 disconnected (attempt {n}). Reconnecting..."] = {
    "en": "⚠️ MT5 disconnected (attempt {n}). Reconnecting...",
    "es": "⚠️ MT5 desconectado (intento {n}). Reconectando...",
}
_TRANSLATIONS["MT5 reconnected successfully"] = {
    "en": "✅ MT5 reconnected successfully",
    "es": "✅ MT5 reconectado exitosamente",
}
_TRANSLATIONS["MT5: 5 consecutive reconnection failures. Check MT5 is open."] = {
    "en": "❌ MT5: 5 consecutive reconnection failures. Check MT5 is open.",
    "es": "❌ MT5: 5 fallos de reconexión consecutivos. Verifica que MT5 esté abierto.",
}
_TRANSLATIONS["MT5 ALERT: Bot failed 5 consecutive reconnection attempts to MetaTrader 5.\nAuto signals may be interrupted. Please verify MT5 is open and connected."] = {
    "en": "🔴 **MT5 ALERT**: Bot failed **5 consecutive** reconnection attempts to MetaTrader 5.\nAuto signals may be interrupted. Please verify MT5 is open and connected.",
    "es": "🔴 **ALERTA MT5**: El bot ha fallado **5 veces consecutivas** al intentar reconectarse a MetaTrader 5.\nLas señales automáticas pueden estar interrumpidas. Por favor verifica que MT5 esté abierto y conectado.",
}

# ── Mobile App Translations ────────────────────────────────────────────────────

_TRANSLATIONS["Dashboard"] = {
    "en": "Dashboard",
    "es": "Dashboard",
}
_TRANSLATIONS["Trades"] = {
    "en": "Trades",
    "es": "Trades",
}
_TRANSLATIONS["Backtests"] = {
    "en": "Backtests",
    "es": "Backtests",
}
_TRANSLATIONS["Settings"] = {
    "en": "Settings",
    "es": "Ajustes",
}
_TRANSLATIONS["Trading Bot Monitor"] = {
    "en": "LastEdge Monitor",
    "es": "Monitor LastEdge",
}
_TRANSLATIONS["EQUITY"] = {
    "en": "EQUITY",
    "es": "EQUIDAD",
}
_TRANSLATIONS["Balance"] = {
    "en": "Balance",
    "es": "Balance",
}
_TRANSLATIONS["Day P&L"] = {
    "en": "Day P&L",
    "es": "P&L Día",
}
_TRANSLATIONS["Win Rate"] = {
    "en": "Win Rate",
    "es": "Win Rate",
}
_TRANSLATIONS["Open Positions"] = {
    "en": "Open Positions",
    "es": "Posiciones Abiertas",
}
_TRANSLATIONS["Pending Signals"] = {
    "en": "Pending Signals",
    "es": "Señales Pendientes",
}
_TRANSLATIONS["All"] = {
    "en": "All",
    "es": "Todas",
}
_TRANSLATIONS["Pending"] = {
    "en": "Pending",
    "es": "Pendientes",
}
_TRANSLATIONS["Active"] = {
    "en": "Active",
    "es": "Activas",
}
_TRANSLATIONS["Rejected"] = {
    "en": "Rejected",
    "es": "Rechazadas",
}
_TRANSLATIONS["Closed"] = {
    "en": "Closed",
    "es": "Cerradas",
}
_TRANSLATIONS["Total P&L"] = {
    "en": "Total P&L",
    "es": "P&L Total",
}
_TRANSLATIONS["Won"] = {
    "en": "Won",
    "es": "Ganadas",
}
_TRANSLATIONS["Lost"] = {
    "en": "Lost",
    "es": "Perdidas",
}
_TRANSLATIONS["Profit Factor"] = {
    "en": "Profit Factor",
    "es": "Profit Factor",
}
_TRANSLATIONS["No signals available"] = {
    "en": "No signals available",
    "es": "No hay señales disponibles",
}
_TRANSLATIONS["No trades available"] = {
    "en": "No trades available",
    "es": "No hay trades disponibles",
}
_TRANSLATIONS["Accept signal"] = {
    "en": "Accept",
    "es": "Aceptar",
}
_TRANSLATIONS["Reject signal"] = {
    "en": "Reject",
    "es": "Rechazar",
}
_TRANSLATIONS["Connection"] = {
    "en": "Connection",
    "es": "Conexión",
}
_TRANSLATIONS["Notifications"] = {
    "en": "Notifications",
    "es": "Notificaciones",
}
_TRANSLATIONS["Interface"] = {
    "en": "Interface",
    "es": "Interfaz",
}
_TRANSLATIONS["Data"] = {
    "en": "Data",
    "es": "Datos",
}
_TRANSLATIONS["About"] = {
    "en": "About",
    "es": "Acerca de",
}
_TRANSLATIONS["Server"] = {
    "en": "Server",
    "es": "Servidor",
}
_TRANSLATIONS["Auto-refresh"] = {
    "en": "Auto-refresh",
    "es": "Actualización automática",
}
_TRANSLATIONS["Background refresh"] = {
    "en": "Background refresh",
    "es": "Actualización en segundo plano",
}
_TRANSLATIONS["Queries the server periodically"] = {
    "en": "Queries the server periodically",
    "es": "Consulta el servidor periódicamente",
}
_TRANSLATIONS["Poll interval"] = {
    "en": "Poll interval",
    "es": "Intervalo de consulta",
}
_TRANSLATIONS["New signals"] = {
    "en": "New signals",
    "es": "Nuevas señales",
}
_TRANSLATIONS["Trade close"] = {
    "en": "Trade close",
    "es": "Cierre de operaciones",
}
_TRANSLATIONS["MT5 disconnect"] = {
    "en": "MT5 disconnect",
    "es": "Desconexión MT5",
}
_TRANSLATIONS["Critical alert if bot loses connection"] = {
    "en": "Critical alert if bot loses connection",
    "es": "Alerta crítica si el bot pierde conexión",
}
_TRANSLATIONS["Haptic feedback"] = {
    "en": "Haptic feedback",
    "es": "Vibración háptica",
}
_TRANSLATIONS["Feedback when pressing test buttons"] = {
    "en": "Feedback when pressing test buttons",
    "es": "Feedback al pulsar botones de prueba",
}
_TRANSLATIONS["Clear notification badge"] = {
    "en": "Clear notification badge",
    "es": "Limpiar badge de notificaciones",
}
_TRANSLATIONS["Reset settings"] = {
    "en": "Reset settings",
    "es": "Restablecer ajustes",
}
_TRANSLATIONS["Version"] = {
    "en": "Version",
    "es": "Versión",
}
_TRANSLATIONS["Platform"] = {
    "en": "Platform",
    "es": "Plataforma",
}
_TRANSLATIONS["Data mode"] = {
    "en": "Data mode",
    "es": "Modo datos",
}
_TRANSLATIONS["Live server"] = {
    "en": "Live server",
    "es": "Servidor en vivo",
}
_TRANSLATIONS["Sample data (dev)"] = {
    "en": "Sample data (dev)",
    "es": "Datos de ejemplo (dev)",
}
_TRANSLATIONS["Test connection"] = {
    "en": "Test connection",
    "es": "Probar conexión",
}
_TRANSLATIONS["Sync"] = {
    "en": "Sync",
    "es": "Sincronizar",
}
_TRANSLATIONS["Permissions"] = {
    "en": "Permissions",
    "es": "Permisos",
}
_TRANSLATIONS["Test alert"] = {
    "en": "Test alert",
    "es": "Probar alerta",
}
_TRANSLATIONS["Save connection"] = {
    "en": "Save connection",
    "es": "Guardar conexión",
}
_TRANSLATIONS["Custom URL (empty = APK)"] = {
    "en": "Custom URL (empty = APK)",
    "es": "URL personalizada (vacío = APK)",
}
_TRANSLATIONS["Custom API token"] = {
    "en": "Custom API token",
    "es": "Token API personalizado",
}
_TRANSLATIONS["Connection saved. App will reload data automatically."] = {
    "en": "Connection saved. App will reload data automatically.",
    "es": "Conexión actualizada. La app recargará datos automáticamente.",
}
_TRANSLATIONS["Reset settings?"] = {
    "en": "Reset settings?",
    "es": "¿Restablecer ajustes?",
}
_TRANSLATIONS["Restore default configuration?"] = {
    "en": "Restore default configuration?",
    "es": "¿Volver a la configuración predeterminada?",
}
_TRANSLATIONS["Done"] = {
    "en": "Done",
    "es": "Hecho",
}
_TRANSLATIONS["Settings reset."] = {
    "en": "Settings reset.",
    "es": "Ajustes restablecidos.",
}
_TRANSLATIONS["Notification badge cleared."] = {
    "en": "Notification badge cleared.",
    "es": "Contador de notificaciones reiniciado.",
}
_TRANSLATIONS["Ready"] = {
    "en": "Ready",
    "es": "Listo",
}
_TRANSLATIONS["Never"] = {
    "en": "Never",
    "es": "Nunca",
}
_TRANSLATIONS["{diff}s ago"] = {
    "en": "{diff}s ago",
    "es": "Hace {diff}s",
}
_TRANSLATIONS["{diff} min ago"] = {
    "en": "{diff} min ago",
    "es": "Hace {diff} min",
}
_TRANSLATIONS["Connected · uptime {uptime}"] = {
    "en": "Connected · uptime {uptime}",
    "es": "Conectado · uptime {uptime}",
}
_TRANSLATIONS["Disconnected"] = {
    "en": "Disconnected",
    "es": "Desconectado",
}
_TRANSLATIONS["Effective URL"] = {
    "en": "Effective URL",
    "es": "URL efectiva",
}
_TRANSLATIONS["Not configured"] = {
    "en": "Not configured",
    "es": "No configurado",
}
_TRANSLATIONS["API Token"] = {
    "en": "API Token",
    "es": "Token API",
}
_TRANSLATIONS["Configured · {masked}"] = {
    "en": "Configured · {masked}",
    "es": "Configurado · {masked}",
}
_TRANSLATIONS["Last sync"] = {
    "en": "Last sync",
    "es": "Última sincronización",
}
_TRANSLATIONS["Test result"] = {
    "en": "Test result",
    "es": "Resultado de prueba",
}
_TRANSLATIONS["OK · {latency} ms · MT5 {mt5_status} · {equity} €"] = {
    "en": "OK · {latency} ms · MT5 {mt5_status} · {equity} €",
    "es": "OK · {latency} ms · MT5 {mt5_status} · {equity} €",
}
_TRANSLATIONS["Could not connect to server"] = {
    "en": "Could not connect to server",
    "es": "No se pudo conectar al servidor",
}
_TRANSLATIONS["Permissions granted · push active"] = {
    "en": "Permissions granted · push active",
    "es": "Permisos concedidos · push activo",
}
_TRANSLATIONS["Permissions granted · local notifications"] = {
    "en": "Permissions granted · local notifications",
    "es": "Permisos concedidos · notificaciones locales",
}
_TRANSLATIONS["Permissions denied — enable in System Settings"] = {
    "en": "Permissions denied — enable in System Settings",
    "es": "Permisos denegados — actívalos en Ajustes del sistema",
}
_TRANSLATIONS["Test notification"] = {
    "en": "🔔 Test notification",
    "es": "🔔 Notificación de prueba",
}
_TRANSLATIONS["If you see this, local alerts work correctly."] = {
    "en": "If you see this, local alerts work correctly.",
    "es": "Si ves esto, las alertas locales funcionan correctamente.",
}
_TRANSLATIONS["Language"] = {
    "en": "Language",
    "es": "Idioma",
}
_TRANSLATIONS["App language"] = {
    "en": "App language",
    "es": "Idioma de la app",
}
_TRANSLATIONS["Change the app interface language"] = {
    "en": "Change the app interface language",
    "es": "Cambiar el idioma de la interfaz",
}


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def set_language(lang: str) -> None:
    """
    Set the current language.
    
    Args:
        lang: Language code ('en' or 'es')
    """
    global _current_language
    if lang not in ("en", "es"):
        logger.warning(f"Unsupported language: {lang}. Falling back to English.")
        lang = "en"
    _current_language = lang
    logger.info(f"Language set to: {lang}")


def get_language() -> str:
    """Get the current language code."""
    return _current_language


def get_language_name(lang: str = None) -> str:
    """Get the human-readable name of a language."""
    if lang is None:
        lang = _current_language
    return {"en": "English", "es": "Español"}.get(lang, "English")


def _(text: str, **kwargs) -> str:
    """
    Translate a string to the current language.
    
    Args:
        text: English source string to translate
        **kwargs: Format parameters to substitute
        
    Returns:
        Translated string with format parameters applied
    """
    entry = _TRANSLATIONS.get(text)
    if entry is None:
        # No translation found — return English with formatting
        if kwargs:
            try:
                return text.format(**kwargs)
            except KeyError:
                return text
        return text
    
    translated = entry.get(_current_language, entry.get("en", text))
    
    if kwargs:
        try:
            return translated.format(**kwargs)
        except KeyError:
            return translated
    
    return translated


# Aliases
translate = _
t = _


def has_translation(text: str) -> bool:
    """Check if a translation exists for the given text."""
    return text in _TRANSLATIONS


def get_supported_languages() -> list:
    """Get list of supported language codes."""
    return ["en", "es"]


def get_supported_languages_display() -> list:
    """Get list of supported languages with display names."""
    return [
        {"code": "en", "name": "English", "flag": "🇬🇧"},
        {"code": "es", "name": "Español", "flag": "🇪🇸"},
    ]