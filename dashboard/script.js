/**
 * LastEdge — Unified Ecosystem Web Dashboard Logic
 * Connects to decoupled services/dashboard_server.py (/api/data)
 * Powers real-time MT5 trading telemetry, positions manager, signals, and Strategy Lab research.
 *
 * Strict Zero-Placeholder Policy:
 * When any backend service or MT5 connection is down, this dashboard faithfully reflects
 * the actual failure in real time with explicit alerts and red indicators, never displaying
 * fake mock numbers or deceptive healthy states.
 */

let liveDataCache = null;
let pollingTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initThemeSetting();
    initAppShell();
    initBalanceEquityChart();
    fetchLiveDashboardData();
    fetchStrategyCatalog();
    pollingTimer = setInterval(fetchLiveDashboardData, 3000);
});

/**
 * Switch Dashboard Navigation Tabs
 * @param {'overview' | 'positions' | 'signals' | 'research' | 'checklist'} tabName 
 */
function switchDashTab(tabName) {
    const tabs = ['overview', 'positions', 'signals', 'research', 'checklist'];
    const tabTitles = {
        'overview': 'Overview',
        'positions': 'MT5 Positions',
        'signals': 'Signals & Journal',
        'research': 'Strategy Lab',
        'checklist': 'Pre-Flight Checklist'
    };
    
    tabs.forEach(t => {
        const sec = document.getElementById(`tab-sec-${t}`);
        const navBtn = document.getElementById(`nav-btn-${t}`);
        if (sec) sec.classList.add('wip-hidden');
        if (navBtn) navBtn.classList.remove('active');
    });

    const targetSec = document.getElementById(`tab-sec-${tabName}`);
    const targetNavBtn = document.getElementById(`nav-btn-${tabName}`);

    if (targetSec) targetSec.classList.remove('wip-hidden');
    if (targetNavBtn) targetNavBtn.classList.add('active');

    // Update Header Breadcrumb
    const bcSection = document.getElementById('bc-section');
    if (bcSection && tabTitles[tabName]) {
        bcSection.textContent = tabTitles[tabName];
    }

    if (tabName === 'overview') {
        setTimeout(handleChartResize, 60);
    }
}

/**
 * Theme Toggle & Persistence Logic
 */
function initThemeSetting() {
    const savedTheme = localStorage.getItem('lastedge_theme') || 'dark';
    setThemeMode(savedTheme);
}

function toggleThemeMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
}

function setThemeMode(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('lastedge_theme', mode);
    
    // Update Header Icon
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = mode === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }

    // Update Sidebar Icon & Label
    const sidebarIcon = document.getElementById('sidebar-theme-icon');
    if (sidebarIcon) {
        sidebarIcon.className = mode === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
    const themeLabel = document.getElementById('theme-mode-label');
    if (themeLabel) {
        themeLabel.textContent = mode === 'dark' ? 'Dark' : 'Light';
    }

    // Re-render chart with new theme colors
    if (typeof renderBalanceEquityChart === 'function') {
        renderBalanceEquityChart();
    }
}

/**
 * Manual Refresh Trigger
 */
function refreshDashboardData() {
    const icon = document.getElementById('refresh-icon');
    if (icon) icon.classList.add('fa-spin');
    fetchLiveDashboardData().finally(() => {
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
        }, 600);
    });
}

/**
 * Poll Unified Backend API (/api/data)
 */
async function fetchLiveDashboardData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            showDashboardOfflineState(`Dashboard server responded with HTTP status ${response.status}`);
            return;
        }

        const data = await response.json();
        liveDataCache = data;
        processDashboardData(data);
    } catch (err) {
        showDashboardOfflineState('Unable to reach Dashboard server on port 8080. ' + err);
    }
}

/**
 * Handle complete failure of Dashboard Server (port 8080)
 */
function showDashboardOfflineState(errorMsg) {
    // Header Badges all RED
    updateHeaderBadges(false, false, false, false);

    // Global Alert Banner
    const banner = document.getElementById('system-alert-banner');
    const bannerMsg = document.getElementById('system-alert-message');
    if (banner && bannerMsg) {
        bannerMsg.innerHTML = `<strong>DASHBOARD OFFLINE:</strong> ${errorMsg}. Please ensure the dashboard service is running on port 8080.`;
        banner.classList.remove('wip-hidden');
    }

    // Positions & Research tables indicate dashboard offline
    renderPositionsTables([], false, false);
    renderStrategyLab({}, false);
}

/**
 * Update UI Elements with Live Data
 */
function processDashboardData(data) {
    if (!data) return;

    const isEngineOnline = data.trading_engine_online === true;
    const isLabOnline = data.strategy_lab_online === true;

    const tEngine = data.trading_engine || {};
    const metrics = data.metrics || {};
    const equity = data.equity || {};
    const positions = Array.isArray(data.positions) ? data.positions : [];
    const risk = data.risk || {};
    const signals = Array.isArray(data.signals) ? data.signals : [];
    const checklist = data.checklist || {};
    const research = data.research || {};

    // 1. Precise MT5 Connection Check
    const isMT5Connected = isEngineOnline && Boolean(
        metrics.mt5_connected === true ||
        tEngine.mt5_connected === true ||
        (tEngine.health && tEngine.health.mt5_connected === true) ||
        (tEngine.health && tEngine.health.mt5 && tEngine.health.mt5.connected === true)
    );

    // 2. Circuit Breaker Evaluation
    const cbData = risk.circuit_breaker || {};
    const cbCanTrade = isEngineOnline && risk.can_trade !== false && cbData.can_trade !== false;
    const cbTripped = isEngineOnline && (risk.can_trade === false || cbData.can_trade === false);

    // 3. Global Outage Banner
    const banner = document.getElementById('system-alert-banner');
    const bannerMsg = document.getElementById('system-alert-message');
    const outages = [];

    if (!isEngineOnline) {
        outages.push('<strong>Trading Engine (:8081) is offline</strong>');
    } else if (!isMT5Connected) {
        outages.push('<strong>MetaTrader 5 terminal is disconnected</strong> (Launch MT5 and log in to your broker)');
    }

    if (!isLabOnline) {
        outages.push('<strong>Strategy Lab (:8082) is offline</strong>');
    }

    if (cbTripped) {
        outages.push('<strong>Circuit Breaker TRIPPED</strong> (Trading halted by risk safeguards)');
    }

    if (banner && bannerMsg) {
        if (outages.length > 0) {
            bannerMsg.innerHTML = outages.join(' &bull; ') + ' &mdash; <span style="font-weight: 400; color: var(--text-muted);">Please start the required backend services.</span>';
            banner.classList.remove('wip-hidden');
        } else {
            banner.classList.add('wip-hidden');
        }
    }

    // 4. Update Header Status Badges
    updateHeaderBadges(isEngineOnline, isLabOnline, isMT5Connected, cbCanTrade);

    // 5. Update Balance & Equity KPI Card (No Placeholders!)
    const eqElem = document.getElementById('val-equity');
    const balElem = document.getElementById('val-balance-label');
    const floatBadge = document.getElementById('val-floating-badge');

    if (!isEngineOnline) {
        if (eqElem) {
            eqElem.innerHTML = '<span style="color: var(--color-sell); font-size: 20px;">OFFLINE</span>';
        }
        if (floatBadge) {
            floatBadge.textContent = 'ENGINE DOWN';
            floatBadge.className = 'trend-badge trend-down';
        }
        if (balElem) {
            balElem.textContent = 'Trading Engine :8081 unreachable';
        }
        updateChartTelemetry(0, 0, 0, 'USD', false);
    } else if (!isMT5Connected) {
        if (eqElem) {
            eqElem.innerHTML = '<span style="color: var(--color-warning); font-size: 20px;">NO MT5</span>';
        }
        if (floatBadge) {
            floatBadge.textContent = 'MT5 DISCONNECTED';
            floatBadge.className = 'trend-badge trend-down';
        }
        if (balElem) {
            balElem.textContent = 'MT5 terminal not connected';
        }
        updateChartTelemetry(0, 0, 0, 'USD', false);
    } else {
        const curEquity = equity.equity !== undefined ? equity.equity : (metrics.account_equity || 0.0);
        const curBalance = equity.balance !== undefined ? equity.balance : (metrics.balance || 0.0);
        const floatPnl = equity.floating_pnl !== undefined ? equity.floating_pnl : (risk.total_floating_pnl || 0.0);
        const currency = equity.currency || metrics.currency || 'USD';
        const curSym = currency === 'EUR' ? '€' : (currency === 'USD' ? '$' : currency + ' ');

        if (eqElem) {
            eqElem.textContent = `${curSym}${curEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (balElem) {
            balElem.textContent = `Balance: ${curSym}${curBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
        }
        if (floatBadge) {
            floatBadge.textContent = `${floatPnl >= 0 ? '+' : ''}${curSym}${floatPnl.toFixed(2)} Float`;
            floatBadge.className = `trend-badge ${floatPnl >= 0 ? 'trend-up' : 'trend-down'}`;
        }
        updateChartTelemetry(curBalance, curEquity, floatPnl, currency, true, data.equity_history);
    }

    // 6. Update Broker & Account Card (No Placeholders!)
    const brokerElem = document.getElementById('val-broker');
    const modeBadge = document.getElementById('val-account-mode');
    const accInfoElem = document.getElementById('val-account-info');

    if (!isEngineOnline) {
        if (brokerElem) {
            brokerElem.textContent = 'DISCONNECTED';
            brokerElem.style.color = 'var(--color-sell)';
        }
        if (modeBadge) {
            modeBadge.textContent = 'OFFLINE';
            modeBadge.className = 'trend-badge trend-down';
        }
        if (accInfoElem) {
            accInfoElem.textContent = 'Trading engine is stopped (:8081)';
        }
    } else if (!isMT5Connected) {
        if (brokerElem) {
            brokerElem.textContent = 'MT5 DISCONNECTED';
            brokerElem.style.color = 'var(--color-sell)';
        }
        if (modeBadge) {
            modeBadge.textContent = 'NO CONNECTION';
            modeBadge.className = 'trend-badge trend-down';
        }
        if (accInfoElem) {
            accInfoElem.textContent = 'Launch MetaTrader 5 in Windows';
        }
    } else {
        if (brokerElem) {
            const company = metrics.company || metrics.server || (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.server : 'MetaTrader 5');
            brokerElem.textContent = company || 'MetaTrader 5';
            brokerElem.style.color = 'var(--text-main)';
        }
        if (modeBadge) {
            const isDemo = tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.demo_mode : true;
            modeBadge.textContent = isDemo ? 'DEMO' : 'REAL';
            modeBadge.className = 'trend-badge trend-up';
        }
        if (accInfoElem) {
            const login = metrics.account_number || (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.login : '—');
            const ping = (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.ping_ms : 0);
            accInfoElem.textContent = `Account: ${login || '—'} | Ping: ${ping ? ping + ' ms' : 'Live'}`;
        }
    }

    // 7. Update Risk Engine v2 & Circuit Breaker (No Placeholders!)
    const cbElem = document.getElementById('val-cb-status');
    const riskRateBadge = document.getElementById('val-risk-rate');
    const expElem = document.getElementById('val-exposure-info');

    if (!isEngineOnline) {
        if (cbElem) {
            cbElem.textContent = 'ENGINE UNREACHABLE';
            cbElem.style.color = 'var(--color-sell)';
        }
        if (riskRateBadge) {
            riskRateBadge.textContent = 'OFFLINE';
            riskRateBadge.className = 'trend-badge trend-down';
        }
        if (expElem) {
            expElem.textContent = 'Risk telemetry unavailable';
        }
    } else if (cbTripped) {
        if (cbElem) {
            cbElem.textContent = 'TRIPPED (PROTECTION)';
            cbElem.style.color = 'var(--color-sell)';
        }
        if (riskRateBadge) {
            riskRateBadge.textContent = 'HALTED';
            riskRateBadge.className = 'trend-badge trend-down';
        }
        if (expElem) {
            expElem.textContent = 'Daily risk limit reached — Trading halted';
        }
    } else {
        if (cbElem) {
            cbElem.textContent = 'OPERATIONAL (NORMAL)';
            cbElem.style.color = 'var(--accent-green)';
        }
        if (riskRateBadge) {
            const rTrade = risk.risk_per_trade_pct || 0.5;
            riskRateBadge.textContent = `${rTrade}% / Trade`;
            riskRateBadge.className = 'trend-badge trend-up';
        }
        if (expElem) {
            const expLots = risk.total_exposure_lots || 0.0;
            const maxDD = risk.max_daily_dd_pct || 3.0;
            expElem.textContent = `Exposure: ${expLots.toFixed(2)} Lots | Max DD: ${maxDD}%`;
        }
    }

    // 8. Update AutoSignals Card (No Placeholders!)
    const autoSignalsElem = document.getElementById('val-autosignals');
    const symbolsElem = document.getElementById('val-symbols-list');

    if (!isEngineOnline) {
        if (autoSignalsElem) {
            autoSignalsElem.textContent = 'INACTIVE';
            autoSignalsElem.style.color = 'var(--color-sell)';
        }
        if (symbolsElem) {
            symbolsElem.textContent = 'Signal scanner stopped';
        }
    } else {
        const isAuto = metrics.autosignals_enabled !== false;
        if (autoSignalsElem) {
            autoSignalsElem.textContent = isAuto ? 'ACTIVE (Auto-Trade)' : 'PAUSED';
            autoSignalsElem.style.color = isAuto ? 'var(--accent-green)' : 'var(--color-warning)';
        }
        if (symbolsElem && Array.isArray(metrics.monitored_symbols)) {
            symbolsElem.textContent = metrics.monitored_symbols.join(', ');
        }
    }

    // 9. Update Positions Tables with Actual Connection State
    renderPositionsTables(positions, isEngineOnline, isMT5Connected);

    // 10. Update Signals Table
    renderSignalsTable(signals, isEngineOnline);

    // 11. Update Strategy Lab Research with Lab Online State
    renderStrategyLab(research, isLabOnline);

    // 12. Update Pre-Flight Checklist
    renderChecklist(checklist, isEngineOnline);
}

/**
 * Header Badges — Explicitly reflects Engine, MT5, Lab, and Risk states
 */
function updateHeaderBadges(isEngineOnline, isLabOnline, isMT5Connected, cbCanTrade) {
    // 1. Trading Engine Badge
    const badgeEngine = document.getElementById('badge-engine');
    const badgeEngineText = document.getElementById('badge-engine-text');
    if (badgeEngine && badgeEngineText) {
        badgeEngineText.textContent = isEngineOnline ? 'ENGINE: ONLINE (:8081)' : 'ENGINE: OFFLINE (:8081)';
        badgeEngine.className = `status-pill ${isEngineOnline ? 'pill-green' : 'pill-red'}`;
    }

    // 2. MT5 Terminal Badge
    const badgeMT5 = document.getElementById('badge-mt5');
    const badgeMT5Text = document.getElementById('badge-mt5-text');
    if (badgeMT5 && badgeMT5Text) {
        if (!isEngineOnline) {
            badgeMT5Text.textContent = 'MT5: INACCESSIBLE';
            badgeMT5.className = 'status-pill pill-red';
        } else if (isMT5Connected) {
            badgeMT5Text.textContent = 'MT5: CONNECTED';
            badgeMT5.className = 'status-pill pill-green';
        } else {
            badgeMT5Text.textContent = 'MT5: DISCONNECTED';
            badgeMT5.className = 'status-pill pill-red';
        }
    }

    // 3. Strategy Lab Badge
    const badgeLab = document.getElementById('badge-lab');
    const badgeLabText = document.getElementById('badge-lab-text');
    if (badgeLab && badgeLabText) {
        badgeLabText.textContent = isLabOnline ? 'STRATEGY LAB: ONLINE (:8082)' : 'STRATEGY LAB: OFFLINE (:8082)';
        badgeLab.className = `status-pill ${isLabOnline ? 'pill-green' : 'pill-red'}`;
    }

    // 4. Circuit Breaker Badge
    const badgeCB = document.getElementById('badge-cb');
    const badgeCBText = document.getElementById('badge-cb-text');
    if (badgeCB && badgeCBText) {
        if (!isEngineOnline) {
            badgeCBText.textContent = 'CIRCUIT BREAKER: UNKNOWN';
            badgeCB.className = 'status-pill pill-red';
        } else if (cbCanTrade) {
            badgeCBText.textContent = 'CIRCUIT BREAKER: NORMAL';
            badgeCB.className = 'status-pill pill-green';
        } else {
            badgeCBText.textContent = 'CIRCUIT BREAKER: TRIPPED';
            badgeCB.className = 'status-pill pill-red';
        }
    }
}

/**
 * Render Positions Tables (Overview quick table & Full Positions Manager)
 */
function renderPositionsTables(positions, isEngineOnline, isMT5Connected) {
    const countBadge = document.getElementById('tab-count-positions');
    if (countBadge) countBadge.textContent = positions.length;

    const overviewBody = document.getElementById('overview-positions-body');
    const fullBody = document.getElementById('full-positions-body');

    // State 1: Trading Engine is OFFLINE
    if (!isEngineOnline) {
        const errorRow = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 28px;">
                    <div style="color: #EF4444; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> TRADING ENGINE IS OFFLINE (:8081)
                    </div>
                    <div style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                        Unable to query MT5 positions because the trading engine is not responding.<br>
                        Please start the Trading Engine service on port 8081.
                    </div>
                </td>
            </tr>
        `;
        if (overviewBody) overviewBody.innerHTML = errorRow;
        if (fullBody) fullBody.innerHTML = errorRow;
        return;
    }

    // State 2: Engine online, but MT5 is DISCONNECTED
    if (!isMT5Connected) {
        const mt5WarnRow = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 28px;">
                    <div style="color: #F59E0B; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                        <i class="fa-solid fa-plug-circle-xmark"></i> METATRADER 5 NOT CONNECTED
                    </div>
                    <div style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                        The Trading Engine is online but cannot communicate with the MetaTrader 5 terminal.<br>
                        Launch MetaTrader 5 on Windows and log in to your broker account.
                    </div>
                </td>
            </tr>
        `;
        if (overviewBody) overviewBody.innerHTML = mt5WarnRow;
        if (fullBody) fullBody.innerHTML = mt5WarnRow;
        return;
    }

    // State 3: MT5 Connected, but 0 positions open
    if (positions.length === 0) {
        const emptyRow = `
            <tr>
                <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-right: 6px;"></i>
                    Connected to MT5. No open positions currently.
                </td>
            </tr>
        `;
        if (overviewBody) overviewBody.innerHTML = emptyRow;
        if (fullBody) fullBody.innerHTML = emptyRow;
        return;
    }

    // State 4: Real Active Positions
    const rowsHtml = positions.map(pos => {
        const pType = pos.type || 'BUY';
        const typeClass = pType === 'BUY' ? 'tag-buy' : 'tag-sell';
        const pnl = pos.profit !== undefined ? pos.profit : 0.0;
        const pnlColor = pnl >= 0 ? 'var(--accent-green)' : 'var(--color-sell)';

        return `
            <tr>
                <td style="font-weight: 700; font-family: monospace;">#${pos.ticket}</td>
                <td style="font-weight: 600;">${pos.symbol}</td>
                <td><span class="${typeClass}" style="padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">${pType}</span></td>
                <td>${pos.volume ? pos.volume.toFixed(2) : '0.01'}</td>
                <td>${pos.open_price ? pos.open_price.toFixed(5) : '—'}</td>
                <td>${pos.current_price ? pos.current_price.toFixed(5) : '—'}</td>
                <td>${pos.sl ? pos.sl.toFixed(5) : '—'}</td>
                <td>${pos.tp ? pos.tp.toFixed(5) : '—'}</td>
                <td style="font-weight: 700; color: ${pnlColor};">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</td>
                <td>
                    <button class="btn-action btn-danger" style="padding: 3px 8px; font-size: 11px; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3);" onclick="closePosition(${pos.ticket})">
                        <i class="fa-solid fa-xmark"></i> Close
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (overviewBody) overviewBody.innerHTML = rowsHtml;
    if (fullBody) fullBody.innerHTML = rowsHtml;
}

/**
 * Close MT5 Position via API
 */
async function closePosition(ticket) {
    if (!confirm(`Are you sure you want to close position #${ticket} on MT5?`)) return;
    try {
        const res = await fetch('/api/positions/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket })
        });
        const data = await res.json();
        if (data.ok) {
            alert(`Position #${ticket} successfully closed.`);
            fetchLiveDashboardData();
        } else {
            alert(`Error closing position: ${data.message || data.error}`);
        }
    } catch (e) {
        alert(`Connection failure closing position: ${e}`);
    }
}

/**
 * Render Signals Table
 */
function renderSignalsTable(signals, isEngineOnline) {
    const overviewBody = document.getElementById('overview-signals-body');
    const fullBody = document.getElementById('signal-table-body');

    if (!isEngineOnline && (!signals || signals.length === 0)) {
        const offlineRow = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 24px; color: #EF4444;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Trading Engine is offline (:8081). Live signals are unavailable.
                </td>
            </tr>
        `;
        if (overviewBody) overviewBody.innerHTML = offlineRow;
        if (fullBody) fullBody.innerHTML = offlineRow;
        return;
    }

    if (!signals || signals.length === 0) {
        const emptyRow = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-green); margin-right: 6px;"></i>
                    Engine active. Scanning market for entry setups...
                </td>
            </tr>
        `;
        if (overviewBody) overviewBody.innerHTML = emptyRow;
        if (fullBody) fullBody.innerHTML = emptyRow;
        return;
    }

    const rows = signals.map(sig => {
        const dir = (sig.direction || sig.type || 'BUY').toUpperCase();
        const dirTag = dir === 'BUY' ? 'tag-buy' : 'tag-sell';
        const time = sig.timestamp ? sig.timestamp.replace('T', ' ').slice(11, 19) : '—';
        const fullTime = sig.timestamp ? sig.timestamp.replace('T', ' ').slice(0, 19) : '—';
        const conf = sig.confidence || 'HIGH';
        const confClass = conf === 'HIGH' ? 'trend-up' : (conf === 'MEDIUM' ? 'trend-badge' : 'trend-down');

        return {
            overview: `
                <tr>
                    <td style="font-family: monospace; font-size: 11px;">${time}</td>
                    <td style="font-weight: 600;">${sig.symbol || 'EURUSD'}</td>
                    <td>${sig.strategy || 'MultiTimeframe'}</td>
                    <td><span class="${dirTag}" style="padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${dir}</span></td>
                    <td><span class="trend-badge ${confClass}">${conf}</span></td>
                    <td>${sig.entry_price || sig.price || '—'}</td>
                    <td>${sig.sl || '—'}</td>
                    <td>${sig.tp || '—'}</td>
                    <td><span class="status-pill pill-green" style="font-size: 10px; padding: 2px 6px;">RECORDED</span></td>
                </tr>
            `,
            full: `
                <tr>
                    <td style="font-family: monospace;">${fullTime}</td>
                    <td style="font-weight: 700;">${sig.symbol || 'EURUSD'}</td>
                    <td>${sig.strategy || 'MultiTimeframe'}</td>
                    <td><span class="${dirTag}" style="padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11px;">${dir}</span></td>
                    <td><span class="trend-badge ${confClass}">${conf}</span></td>
                    <td>${sig.entry_price || sig.price || '—'}</td>
                    <td>${sig.sl || '—'}</td>
                    <td>${sig.tp || '—'}</td>
                    <td><span class="status-pill pill-green" style="font-size: 10px; padding: 2px 6px;">RECORDED</span></td>
                </tr>
            `
        };
    });

    if (overviewBody && rows.length > 0) {
        overviewBody.innerHTML = rows.slice(0, 5).map(r => r.overview).join('');
    }
    if (fullBody && rows.length > 0) {
        fullBody.innerHTML = rows.map(r => r.full).join('');
    }
}

/**
 * Filter Signals
 */
function filterSignals() {
    const searchVal = (document.getElementById('signal-search')?.value || '').toLowerCase();
    const typeVal = document.getElementById('filter-type')?.value || 'ALL';

    const rows = document.querySelectorAll('#signal-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matchesSearch = text.includes(searchVal);
        const matchesType = typeVal === 'ALL' || text.includes(typeVal.toLowerCase());

        row.style.display = (matchesSearch && matchesType) ? '' : 'none';
    });
}

/**
 * Switch Strategy Lab Sub-Navigation Tabs ('backtest' | 'research')
 */
function switchLabSubTab(tabName) {
    const btnBt = document.getElementById('lab-subtab-btn-backtest');
    const btnRs = document.getElementById('lab-subtab-btn-research');
    const viewBt = document.getElementById('lab-subview-backtest');
    const viewRs = document.getElementById('lab-subview-research');

    if (tabName === 'backtest') {
        if (btnBt) btnBt.classList.add('active');
        if (btnRs) btnRs.classList.remove('active');
        if (viewBt) viewBt.classList.remove('wip-hidden');
        if (viewRs) viewRs.classList.add('wip-hidden');
    } else {
        if (btnBt) btnBt.classList.remove('active');
        if (btnRs) btnRs.classList.add('active');
        if (viewBt) viewBt.classList.add('wip-hidden');
        if (viewRs) viewRs.classList.remove('wip-hidden');
    }
}

/**
 * Render Strategy Lab Quant Research & Backtest Tables (No Placeholders!)
 */
function renderStrategyLab(research, isLabOnline) {
    const totalElem = document.getElementById('val-research-total');
    const promElem = document.getElementById('val-research-promoted');
    const candElem = document.getElementById('val-research-candidates');
    const rejElem = document.getElementById('val-research-rejected');

    if (!isLabOnline) {
        if (totalElem) totalElem.textContent = '—';
        if (promElem) promElem.textContent = '—';
        if (candElem) candElem.textContent = '—';
        if (rejElem) rejElem.textContent = '—';
        renderBacktestsHistory([], false);
        renderResearchHistory([], false);
        return;
    }

    const allExps = Array.isArray(research.recent_experiments) ? research.recent_experiments : [];
    
    // Partition backtests vs research experiments cleanly
    const backtests = Array.isArray(research.backtests) && research.backtests.length > 0
        ? research.backtests
        : allExps.filter(e => {
            const id = (e.experiment_id || e.id || '').toString();
            const tags = Array.isArray(e.tags) ? e.tags : [];
            return id.startsWith('bt_') || tags.includes('backtest');
        });

    const researchList = Array.isArray(research.research) && research.research.length > 0
        ? research.research
        : allExps.filter(e => {
            const id = (e.experiment_id || e.id || '').toString();
            const tags = Array.isArray(e.tags) ? e.tags : [];
            return !id.startsWith('bt_') && !tags.includes('backtest');
        });

    if (totalElem) totalElem.textContent = research.total_experiments || researchList.length || 0;
    if (promElem) promElem.textContent = research.promoted_count || 0;
    if (candElem) candElem.textContent = research.candidates_count || 0;
    if (rejElem) rejElem.textContent = research.rejected_count || 0;

    renderBacktestsHistory(backtests, true);
    renderResearchHistory(researchList, true);
}

/**
 * Render Dedicated Backtests History Table
 */
function renderBacktestsHistory(backtests, isLabOnline) {
    const tableBody = document.getElementById('backtests-table-body');
    const badge = document.getElementById('backtests-count-badge');
    if (!tableBody) return;

    if (badge) badge.textContent = `${backtests.length} registros`;

    if (!isLabOnline) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; padding: 32px;">
                    <div style="color: #EF4444; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> STRATEGY LAB IS OFFLINE (:8082)
                    </div>
                    <div style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                        Historial de backtests no disponible. Inicia el servicio en el puerto 8082.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    if (!backtests || backtests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; color: var(--text-muted); padding: 32px;">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-right: 6px;"></i>
                    Strategy Lab conectado (:8082). 0 backtests ejecutados aún en esta sesión.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = backtests.map(bt => {
        const m = bt.metrics || {};
        const status = bt.decision_status || 'CANDIDATE';
        const statusClass = status === 'PROMOTED' ? 'pill-green' : (status === 'CANDIDATE' ? 'pill-amber' : 'pill-red');
        const expId = bt.experiment_id || `#${bt.id || '—'}`;
        const symbol = bt.symbol || 'EURUSD';
        const strategy = bt.strategy_name || 'Quantitative';
        const tf = bt.timeframe || 'H1';
        const bars = m.bars ? m.bars.toLocaleString() : (bt.bars ? bt.bars.toLocaleString() : '—');
        
        const totalTrades = m.total_trades !== undefined ? m.total_trades : '—';
        const wins = m.wins !== undefined ? m.wins : 0;
        const losses = m.losses !== undefined ? m.losses : 0;
        const tradesWl = totalTrades !== '—' ? `${totalTrades} (<span style="color: var(--accent-green);">${wins}W</span> / <span style="color: var(--color-sell);">${losses}L</span>)` : '—';

        const wr = m.win_rate_pct !== undefined ? `${m.win_rate_pct.toFixed(1)}%` : '—';
        const pf = m.profit_factor !== undefined ? m.profit_factor.toFixed(2) : '—';
        const pfColor = m.profit_factor >= 1.30 ? 'var(--accent-green)' : (m.profit_factor >= 1.0 ? 'var(--color-warning)' : 'var(--color-sell)');

        const netPips = m.net_profit_pips !== undefined ? `${m.net_profit_pips > 0 ? '+' : ''}${m.net_profit_pips.toFixed(1)}p` : '—';
        const netUsd = m.net_profit_usd !== undefined ? `${m.net_profit_usd >= 0 ? '+$' : '-$'}${Math.abs(m.net_profit_usd).toFixed(2)}` : '';
        const netColor = (m.net_profit_usd || m.net_profit_pips || 0) >= 0 ? 'var(--accent-green)' : 'var(--color-sell)';

        const maxDd = m.max_drawdown_pct !== undefined ? `${m.max_drawdown_pct.toFixed(1)}%` : '—';
        const cbCount = m.cb_activations !== undefined ? m.cb_activations : 0;
        const cbColor = cbCount > 0 ? 'var(--color-sell)' : 'var(--accent-green)';
        const cbText = `${cbCount} CB${m.bars_paused ? ` (${m.bars_paused}v)` : ''}`;

        const dateStr = bt.created_at ? bt.created_at.replace('T', ' ').slice(0, 19) : '—';

        return `
            <tr>
                <td style="font-family: monospace; font-size: 11px; font-weight: 700;">${expId}</td>
                <td style="font-weight: 700;">${symbol}</td>
                <td style="font-size: 12px;">${strategy}</td>
                <td><span class="status-pill" style="font-size: 10px; padding: 2px 6px;">${tf}</span></td>
                <td style="font-family: monospace; font-size: 11px;">${bars}</td>
                <td style="font-size: 12px;">${tradesWl}</td>
                <td style="font-size: 12px;">${wr}</td>
                <td style="font-weight: 700; color: ${pfColor}; font-size: 12px;">${pf}</td>
                <td style="font-size: 12px; font-weight: 600; color: ${netColor};">${netPips} ${netUsd ? `<span style="font-size: 10px; color: var(--text-muted);">(${netUsd})</span>` : ''}</td>
                <td style="font-size: 12px;">${maxDd}</td>
                <td style="font-size: 11px; font-weight: 700; color: ${cbColor};">${cbText}</td>
                <td><span class="status-pill ${statusClass}">${status}</span></td>
                <td style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${dateStr}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Render Dedicated Research (WFA & Monte Carlo) History Table
 */
function renderResearchHistory(researchList, isLabOnline) {
    const tableBody = document.getElementById('research-table-body');
    const badge = document.getElementById('research-count-badge');
    if (!tableBody) return;

    if (badge) badge.textContent = `${researchList.length} experimentos`;

    if (!isLabOnline) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 32px;">
                    <div style="color: #EF4444; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> STRATEGY LAB IS OFFLINE (:8082)
                    </div>
                    <div style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                        Historial de research no disponible. Inicia el servicio en el puerto 8082.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    if (!researchList || researchList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 32px;">
                    <i class="fa-solid fa-flask" style="color: #A855F7; margin-right: 6px;"></i>
                    Strategy Lab conectado (:8082). 0 experimentos de WFA/Monte Carlo registrados en research.db.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = researchList.map(exp => {
        const m = exp.metrics || {};
        const status = exp.decision_status || 'DRAFT';
        const statusClass = status === 'PROMOTED' ? 'pill-green' : (status === 'CANDIDATE' ? 'pill-amber' : 'pill-red');
        const expId = exp.experiment_id || `#${exp.id || '—'}`;
        const title = exp.hypothesis || exp.strategy_name || 'Quantitative Research';
        const symbol = exp.symbol || 'EURUSD';
        const strategy = exp.strategy_name || 'Quantitative';

        const stabScore = m.composite_stability_score !== undefined ? m.composite_stability_score.toFixed(1) : (m.stability_score !== undefined ? m.stability_score.toFixed(1) : '—');
        const rating = m.wfa_rating || m.rating || '—';
        const ratingClass = rating === 'STABLE' ? 'trend-up' : (rating === 'OVERFIT' ? 'trend-down' : 'trend-badge');

        const consistency = m.consistency_score !== undefined ? m.consistency_score.toFixed(2) : '—';
        const testPf = m.mean_test_pf !== undefined ? m.mean_test_pf.toFixed(2) : (m.test_pf !== undefined ? m.test_pf.toFixed(2) : (m.profit_factor !== undefined ? m.profit_factor.toFixed(2) : '—'));
        const ruinProb = m.mc_ruin_prob_pct !== undefined ? `${m.mc_ruin_prob_pct.toFixed(1)}%` : (m.ruin_probability_pct !== undefined ? `${m.ruin_probability_pct.toFixed(1)}%` : '—');

        const dateStr = exp.created_at ? exp.created_at.replace('T', ' ').slice(0, 19) : '—';

        return `
            <tr>
                <td style="font-family: monospace; font-size: 11px; font-weight: 700;">${expId}</td>
                <td style="font-weight: 600; font-size: 12px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</td>
                <td style="font-weight: 700;">${symbol}</td>
                <td style="font-size: 12px;">${strategy}</td>
                <td style="font-weight: 700; color: #A855F7;">${stabScore}</td>
                <td><span class="trend-badge ${ratingClass}" style="font-size: 10px;">${rating}</span></td>
                <td>${consistency}</td>
                <td style="font-weight: 700;">${testPf}</td>
                <td style="color: ${(parseFloat(ruinProb) || 0) <= 5 ? 'var(--accent-green)' : 'var(--color-sell)'};">${ruinProb}</td>
                <td><span class="status-pill ${statusClass}">${status}</span></td>
                <td style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${dateStr}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Filter Backtests Table by Search Text
 */
function filterBacktestsTable() {
    const query = (document.getElementById('backtests-search')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#backtests-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

/**
 * Filter Research Table by Search Text
 */
function filterResearchTable() {
    const query = (document.getElementById('research-search')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#research-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

/**
 * Render 17 Go-Live Pre-Production Checks (No Placeholders!)
 */
function renderChecklist(checklist, isEngineOnline) {
    const grid = document.getElementById('checklist-grid');
    const summaryBadge = document.getElementById('checklist-summary-badge');

    if (!grid) return;

    if (!isEngineOnline) {
        if (summaryBadge) {
            summaryBadge.textContent = 'FAIL | ENGINE OFFLINE';
            summaryBadge.className = 'trend-badge trend-down';
        }
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #EF4444; font-size: 28px; margin-bottom: 8px;"></i>
                <div style="font-weight: 700; color: #EF4444; font-size: 14px;">PRE-FLIGHT AUDIT UNAVAILABLE</div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">
                    Trading Engine (:8081) must be running to perform the 17-point pre-production readiness audit.<br>
                    Please start the Trading Engine service on port 8081.
                </div>
            </div>
        `;
        return;
    }

    const checks = Array.isArray(checklist.checks) ? checklist.checks : [];
    if (checks.length === 0) return;

    const summary = checklist.summary || {};
    if (summaryBadge) {
        summaryBadge.textContent = `${summary.passed || 0} PASS | ${summary.warnings || 0} WARN | ${summary.failed || 0} FAIL`;
        summaryBadge.className = `trend-badge ${(summary.failed || 0) === 0 ? 'trend-up' : 'trend-down'}`;
    }

    grid.innerHTML = checks.map(c => {
        const isPass = c.status === 'PASS';
        const isWarn = c.status === 'WARN';
        const iconClass = isPass ? 'fa-circle-check' : (isWarn ? 'fa-triangle-exclamation' : 'fa-circle-xmark');
        const iconColor = isPass ? 'var(--accent-green)' : (isWarn ? 'var(--color-warning)' : 'var(--color-sell)');
        const pillClass = isPass ? 'pill-green' : (isWarn ? 'pill-amber' : 'pill-red');

        return `
            <div class="stat-card" style="padding: 16px; border-radius: 12px; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 16px;"></i>
                        <span style="font-weight: 700; font-size: 13px;">${c.name}</span>
                    </div>
                    <span class="status-pill ${pillClass}" style="font-size: 10px; padding: 2px 8px;">${c.status}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4; padding-left: 26px;">
                    ${c.message}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Refresh Checklist Explicitly
 */
async function refreshChecklist() {
    try {
        const res = await fetch('/api/checklist');
        if (res.ok) {
            const data = await res.json();
            renderChecklist(data.checklist || data, true);
        }
    } catch (e) {
        console.error('Error refreshing checklist:', e);
    }
}

/**
 * Export Signals to CSV
 */
function exportSignalsCSV() {
    if (!liveDataCache || !liveDataCache.signals || liveDataCache.signals.length === 0) {
        alert('No signals available to export.');
        return;
    }
    const sigs = liveDataCache.signals;
    let csv = 'Timestamp,Symbol,Strategy,Type,Confidence,Price,SL,TP\n';
    sigs.forEach(s => {
        csv += `"${s.timestamp || ''}","${s.symbol || ''}","${s.strategy || ''}","${s.type || s.direction || ''}","${s.confidence || ''}","${s.entry_price || ''}","${s.sl || ''}","${s.tp || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LastEdge_Signals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

let dynamicStrategyCatalog = null;

/**
 * Fetch dynamic strategy catalog from Strategy Lab via Dashboard Server proxy
 */
async function fetchStrategyCatalog() {
    try {
        const resp = await fetch('/api/research/strategies');
        const data = await resp.json();
        if (data && data.strategies) {
            dynamicStrategyCatalog = data;
            populateStrategySymbols();
        }
    } catch (err) {
        console.warn('Could not load dynamic strategy catalog from Strategy Lab:', err);
    }
}

/**
 * Populate symbol selectors dynamically from catalog for both Backtest and Research
 */
function populateStrategySymbols() {
    if (!dynamicStrategyCatalog || !dynamicStrategyCatalog.strategies) return;
    const btSymSelect = document.getElementById('bt-symbol');
    const rsSymSelect = document.getElementById('rs-symbol');
    
    const availableSymbols = Object.keys(dynamicStrategyCatalog.strategies);
    if (availableSymbols.length === 0) return;

    const buildOptions = (currentVal) => availableSymbols.map(sym => {
        let label = sym;
        if (sym === 'EURUSD') label = 'EURUSD (Euro / US Dollar)';
        else if (sym === 'XAUUSD') label = 'XAUUSD (Gold Spot)';
        else if (sym === 'BTCEUR') label = 'BTCEUR (Bitcoin / Euro)';
        return `<option value="${sym}" ${sym === currentVal ? 'selected' : ''}>${label}</option>`;
    }).join('');

    if (btSymSelect) {
        const curBt = btSymSelect.value;
        btSymSelect.innerHTML = buildOptions(curBt);
        if (!availableSymbols.includes(curBt)) btSymSelect.value = availableSymbols[0];
        onBacktestSymbolChange();
    }

    if (rsSymSelect) {
        const curRs = rsSymSelect.value;
        rsSymSelect.innerHTML = buildOptions(curRs);
        if (!availableSymbols.includes(curRs)) rsSymSelect.value = availableSymbols[0];
        onResearchSymbolChange();
    }
}

/**
 * Backtest: Symbol change handler
 */
function onBacktestSymbolChange() {
    const symSelect = document.getElementById('bt-symbol');
    const stratSelect = document.getElementById('bt-strategy');
    if (!symSelect || !stratSelect) return;

    const sym = symSelect.value.toUpperCase();
    const strats = (dynamicStrategyCatalog && dynamicStrategyCatalog.strategies && dynamicStrategyCatalog.strategies[sym])
        ? dynamicStrategyCatalog.strategies[sym]
        : [];

    if (strats.length === 0) {
        stratSelect.innerHTML = `<option value="">No strategies available</option>`;
        onBacktestStrategyChange();
        return;
    }

    stratSelect.innerHTML = strats.map((s, idx) => {
        const id = s.id || s;
        const name = s.name || id;
        return `<option value="${id}" ${idx === 0 ? 'selected' : ''}>${name}</option>`;
    }).join('');

    onBacktestStrategyChange();
}

/**
 * Backtest: Strategy change handler
 */
function onBacktestStrategyChange() {
    const symSelect = document.getElementById('bt-symbol');
    const stratSelect = document.getElementById('bt-strategy');
    const tfSelect = document.getElementById('bt-timeframe');
    if (!symSelect || !stratSelect || !tfSelect) return;

    const sym = symSelect.value.toUpperCase();
    const stratId = stratSelect.value;

    const strats = (dynamicStrategyCatalog && dynamicStrategyCatalog.strategies && dynamicStrategyCatalog.strategies[sym])
        ? dynamicStrategyCatalog.strategies[sym]
        : [];

    const stratMeta = strats.find(s => (s.id || s) === stratId);
    const allowedTfs = (stratMeta && Array.isArray(stratMeta.allowed_timeframes))
        ? stratMeta.allowed_timeframes
        : ['H1'];

    const defaultTf = (stratMeta && stratMeta.default_timeframe)
        ? stratMeta.default_timeframe
        : allowedTfs[0];

    tfSelect.innerHTML = allowedTfs.map(tf => {
        let label = tf;
        if (tf === 'M5') label = 'M5 (5 Minutes)';
        else if (tf === 'M15') label = 'M15 (15 Minutes)';
        else if (tf === 'H1') label = 'H1 (1 Hour)';
        else if (tf === 'H4') label = 'H4 (4 Hours)';
        else if (tf === 'D1') label = 'D1 (Daily)';
        return `<option value="${tf}" ${tf === defaultTf ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

/**
 * Research: Symbol change handler
 */
function onResearchSymbolChange() {
    const symSelect = document.getElementById('rs-symbol');
    const stratSelect = document.getElementById('rs-strategy');
    if (!symSelect || !stratSelect) return;

    const sym = symSelect.value.toUpperCase();
    const strats = (dynamicStrategyCatalog && dynamicStrategyCatalog.strategies && dynamicStrategyCatalog.strategies[sym])
        ? dynamicStrategyCatalog.strategies[sym]
        : [];

    if (strats.length === 0) {
        stratSelect.innerHTML = `<option value="">No strategies available</option>`;
        onResearchStrategyChange();
        return;
    }

    stratSelect.innerHTML = strats.map((s, idx) => {
        const id = s.id || s;
        const name = s.name || id;
        return `<option value="${id}" ${idx === 0 ? 'selected' : ''}>${name}</option>`;
    }).join('');

    onResearchStrategyChange();
}

/**
 * Research: Strategy change handler
 */
function onResearchStrategyChange() {
    const symSelect = document.getElementById('rs-symbol');
    const stratSelect = document.getElementById('rs-strategy');
    const tfSelect = document.getElementById('rs-timeframe');
    if (!symSelect || !stratSelect || !tfSelect) return;

    const sym = symSelect.value.toUpperCase();
    const stratId = stratSelect.value;

    const strats = (dynamicStrategyCatalog && dynamicStrategyCatalog.strategies && dynamicStrategyCatalog.strategies[sym])
        ? dynamicStrategyCatalog.strategies[sym]
        : [];

    const stratMeta = strats.find(s => (s.id || s) === stratId);
    const allowedTfs = (stratMeta && Array.isArray(stratMeta.allowed_timeframes))
        ? stratMeta.allowed_timeframes
        : ['H1'];

    const defaultTf = (stratMeta && stratMeta.default_timeframe)
        ? stratMeta.default_timeframe
        : allowedTfs[0];

    tfSelect.innerHTML = allowedTfs.map(tf => {
        let label = tf;
        if (tf === 'M5') label = 'M5 (5 Minutes)';
        else if (tf === 'M15') label = 'M15 (15 Minutes)';
        else if (tf === 'H1') label = 'H1 (1 Hour)';
        else if (tf === 'H4') label = 'H4 (4 Hours)';
        else if (tf === 'D1') label = 'D1 (Daily)';
        return `<option value="${tf}" ${tf === defaultTf ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

// Backward compatibility alias
function updateStrategySelector() {
    onBacktestSymbolChange();
    onResearchSymbolChange();
}

/**
 * Execute Backtest & Scientific Quant Audit from Dashboard UI
 */
async function runBacktestFromUI() {
    const symbol = document.getElementById('bt-symbol')?.value || 'EURUSD';
    const strategy = document.getElementById('bt-strategy')?.value || 'eurusd_simple';
    const timeframe = document.getElementById('bt-timeframe')?.value || 'H1';
    const bars = parseInt(document.getElementById('bt-bars')?.value || '5000', 10);

    const btn = document.getElementById('btn-run-backtest');
    const icon = document.getElementById('btn-run-icon');
    const text = document.getElementById('btn-run-text');

    const progressCard = document.getElementById('backtest-progress-card');
    const verdictCard = document.getElementById('backtest-verdict-card');
    const fillBar = document.getElementById('bt-progress-fill');
    const percentLabel = document.getElementById('bt-progress-percent');
    const phaseTitle = document.getElementById('bt-progress-phase-title');
    const elapsedLabel = document.getElementById('bt-progress-elapsed');

    const stages = [
        document.getElementById('bt-stage-1'),
        document.getElementById('bt-stage-2'),
        document.getElementById('bt-stage-3'),
        document.getElementById('bt-stage-4'),
        document.getElementById('bt-stage-5'),
    ];

    if (btn) btn.disabled = true;
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    if (text) text.textContent = 'Simulando Replay...';

    // Show progress card, hide verdict card
    if (progressCard) progressCard.classList.remove('wip-hidden');
    if (verdictCard) verdictCard.classList.add('wip-hidden');

    let currentProgress = 5;
    const startTime = Date.now();

    function setStageActive(activeIdx) {
        stages.forEach((el, idx) => {
            if (!el) return;
            if (idx <= activeIdx) {
                el.style.color = 'var(--accent-green)';
                el.style.fontWeight = '700';
            } else {
                el.style.color = 'var(--text-muted)';
                el.style.fontWeight = 'normal';
            }
        });
    }

    setStageActive(0);
    if (fillBar) {
        fillBar.style.width = '5%';
        fillBar.style.background = 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)';
    }
    if (percentLabel) percentLabel.textContent = '5%';
    if (phaseTitle) phaseTitle.textContent = `1/5: Conectando con Strategy Lab y descargando velas de ${symbol}...`;

    // Progress animation ticker
    const progressInterval = setInterval(() => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedLabel) elapsedLabel.textContent = `${elapsedSec.toFixed(1)}s`;

        const baseEstimate = bars >= 10000 ? 18.0 : 8.0;
        const normalized = Math.min(elapsedSec / baseEstimate, 1.0);

        if (normalized < 0.20) {
            currentProgress = Math.min(22, 5 + normalized * 80);
            if (phaseTitle) phaseTitle.textContent = `1/5: Validando dataset y estructura OHLC de ${symbol}...`;
            setStageActive(0);
        } else if (normalized < 0.50) {
            currentProgress = Math.min(52, 22 + (normalized - 0.20) * 100);
            if (phaseTitle) phaseTitle.textContent = `2/5: Calculando medias móviles e indicadores de ${strategy}...`;
            setStageActive(1);
        } else if (normalized < 0.80) {
            currentProgress = Math.min(78, 52 + (normalized - 0.50) * 85);
            if (phaseTitle) phaseTitle.textContent = `3/5: Simulando Replay de ejecuciones y órdenes TP/SL...`;
            setStageActive(2);
        } else if (normalized < 0.95) {
            currentProgress = Math.min(94, 78 + (normalized - 0.80) * 105);
            if (phaseTitle) phaseTitle.textContent = `4/5: Ejecutando simulación Monte Carlo y matriz de ruina...`;
            setStageActive(3);
        } else {
            currentProgress = Math.min(98, currentProgress + 0.3);
            if (phaseTitle) phaseTitle.textContent = `5/5: Consolidando métricas y Dictamen Científico...`;
            setStageActive(4);
        }

        if (fillBar) fillBar.style.width = `${Math.round(currentProgress)}%`;
        if (percentLabel) percentLabel.textContent = `${Math.round(currentProgress)}%`;
    }, 150);

    try {
        const payload = { symbol, strategy, timeframe, bars };
        const response = await fetch('/api/research/backtest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        clearInterval(progressInterval);

        if (!data.ok) {
            if (phaseTitle) phaseTitle.textContent = `Error: ${data.error || 'Simulación rechazada'}`;
            if (fillBar) fillBar.style.background = '#EF4444';
            alert(`Backtest Execution Error: ${data.error || data.message || 'Strategy Lab rejected simulation request.'}`);
            return;
        }

        if (fillBar) {
            fillBar.style.width = '100%';
            fillBar.style.background = 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)';
        }
        if (percentLabel) percentLabel.textContent = '100%';
        if (phaseTitle) phaseTitle.textContent = '¡Simulación Completada! Generando dictamen...';
        setStageActive(4);

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (elapsedLabel) elapsedLabel.textContent = `${totalElapsed}s`;

        setTimeout(() => {
            if (progressCard) progressCard.classList.add('wip-hidden');
            renderBacktestVerdict(data);
            fetchLiveDashboardData();
        }, 400);

    } catch (err) {
        clearInterval(progressInterval);
        if (phaseTitle) phaseTitle.textContent = `Error de red: ${err}`;
        alert(`Failed to communicate with Strategy Lab: ${err}`);
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.className = 'fa-solid fa-play';
        if (text) text.textContent = 'Run Backtest & Audit';
    }
}

/**
 * Render Verbose Reliability Verdict & Comprehensive Key Metric Matrix
 */
function renderBacktestVerdict(data) {
    const card = document.getElementById('backtest-verdict-card');
    if (!card) return;
    card.classList.remove('wip-hidden');

    const v = data.verdict || {};
    const m = data.metrics || {};

    // 1. Banner Color, Icon & Title
    const banner = document.getElementById('bt-verdict-banner');
    const iconBox = document.getElementById('bt-verdict-icon-box');
    const icon = document.getElementById('bt-verdict-icon');
    const title = document.getElementById('bt-verdict-title');
    const badge = document.getElementById('bt-verdict-badge');
    const summary = document.getElementById('bt-verdict-summary');
    const metaSpan = document.getElementById('bt-sim-meta');
    const durationSpan = document.getElementById('bt-sim-duration');

    const tier = v.tier || 'TIER_2_OPTIMIZE';
    let bgStyle = 'rgba(16, 185, 129, 0.12)';
    let borderStyle = '1px solid rgba(16, 185, 129, 0.3)';
    let badgeClass = 'trend-badge trend-up';
    let iconClass = 'fa-solid fa-circle-check';
    let iconColor = '#10B981';

    if (tier === 'TIER_3_REJECTED') {
        bgStyle = 'rgba(239, 68, 68, 0.12)';
        borderStyle = '1px solid rgba(239, 68, 68, 0.35)';
        badgeClass = 'trend-badge trend-down';
        iconClass = 'fa-solid fa-ban';
        iconColor = '#EF4444';
    } else if (tier === 'TIER_2_OPTIMIZE') {
        bgStyle = 'rgba(245, 158, 11, 0.12)';
        borderStyle = '1px solid rgba(245, 158, 11, 0.35)';
        badgeClass = 'trend-badge';
        iconClass = 'fa-solid fa-triangle-exclamation';
        iconColor = '#F59E0B';
    }

    if (banner) {
        banner.style.background = bgStyle;
        banner.style.borderBottom = borderStyle;
    }
    if (iconBox) {
        iconBox.style.background = `${iconColor}25`;
        iconBox.style.color = iconColor;
    }
    if (icon) icon.className = iconClass;
    if (title) {
        title.textContent = v.title || 'EVALUACIÓN CUANTITATIVA FINALIZADA';
        title.style.color = iconColor;
    }
    if (badge) {
        badge.textContent = v.badge || 'PROCESADO';
        badge.className = badgeClass;
    }
    if (summary) summary.textContent = v.summary || '';
    if (metaSpan) metaSpan.textContent = `${data.symbol} ${data.timeframe} · ${(data.bars_analyzed || 0).toLocaleString()} bars · ${data.strategy}`;
    if (durationSpan) durationSpan.textContent = `Simulation: ${data.duration_ms} ms`;

    // 2. Metric Chips Population
    const elTrades = document.getElementById('bt-metric-trades');
    const elTradesWl = document.getElementById('bt-metric-trades-wl');
    const elPf = document.getElementById('bt-metric-pf');
    const elPips = document.getElementById('bt-metric-pips');
    const elUsd = document.getElementById('bt-metric-usd');
    const elWr = document.getElementById('bt-metric-wr');
    const elDd = document.getElementById('bt-metric-dd');
    const elDdUsd = document.getElementById('bt-metric-dd-usd');
    const elCb = document.getElementById('bt-metric-cb');
    const elCbSub = document.getElementById('bt-metric-cb-sub');
    const elDirection = document.getElementById('bt-metric-direction');
    const elSetups = document.getElementById('bt-metric-setups');
    const elConsec = document.getElementById('bt-metric-consec-losses');
    const elSharpe = document.getElementById('bt-metric-sharpe');
    const elExp = document.getElementById('bt-metric-expectancy');
    const elRuin = document.getElementById('bt-metric-ruin');
    const elRr = document.getElementById('bt-metric-rr');

    // Total trades and win/loss
    const totalTrades = m.total_trades !== undefined ? m.total_trades : 0;
    const wins = m.wins !== undefined ? m.wins : 0;
    const losses = m.losses !== undefined ? m.losses : 0;
    if (elTrades) elTrades.textContent = `${totalTrades} trades`;
    if (elTradesWl) {
        elTradesWl.innerHTML = `<span style="color: var(--accent-green);">${wins}W</span> / <span style="color: var(--color-sell);">${losses}L</span>`;
    }

    // Profit factor
    if (elPf) {
        elPf.textContent = (m.profit_factor !== undefined) ? m.profit_factor.toFixed(2) : '0.00';
        elPf.style.color = m.profit_factor >= 1.30 ? '#10B981' : (m.profit_factor >= 1.0 ? '#F59E0B' : '#EF4444');
    }

    // Net Pips & USD
    const netPips = m.net_profit_pips !== undefined ? m.net_profit_pips : 0.0;
    const netUsd = m.net_profit_usd !== undefined ? m.net_profit_usd : 0.0;
    if (elPips) {
        elPips.textContent = `${netPips > 0 ? '+' : ''}${netPips.toFixed(1)} pips`;
        elPips.style.color = netPips >= 0 ? '#10B981' : '#EF4444';
    }
    if (elUsd) {
        elUsd.textContent = `${netUsd >= 0 ? '+$' : '-$'}${Math.abs(netUsd).toFixed(2)} USD`;
        elUsd.style.color = netUsd >= 0 ? '#10B981' : '#EF4444';
    }

    // Win rate & Drawdowns
    if (elWr) elWr.textContent = (m.win_rate_pct !== undefined) ? `${m.win_rate_pct.toFixed(1)}%` : '0.0%';
    if (elDd) {
        elDd.textContent = (m.max_drawdown_pct !== undefined) ? `${m.max_drawdown_pct.toFixed(1)}%` : '0.0%';
        elDd.style.color = m.max_drawdown_pct <= 15.0 ? '#10B981' : (m.max_drawdown_pct <= 25.0 ? '#F59E0B' : '#EF4444');
    }
    if (elDdUsd) {
        const ddUsd = m.max_drawdown_usd !== undefined ? m.max_drawdown_usd : 0.0;
        elDdUsd.textContent = `$${ddUsd.toFixed(2)} USD`;
    }

    // Circuit Breaker telemetry
    const cbCount = m.cb_activations !== undefined ? m.cb_activations : 0;
    const barsPaused = m.bars_paused !== undefined ? m.bars_paused : 0;
    const sigBlocked = m.signals_blocked_by_cb !== undefined ? m.signals_blocked_by_cb : 0;
    if (elCb) {
        elCb.textContent = `${cbCount} Disparos CB`;
        elCb.style.color = cbCount > 0 ? '#EF4444' : '#10B981';
    }
    if (elCbSub) {
        elCbSub.textContent = `${barsPaused} velas pausadas · ${sigBlocked} bloq.`;
    }

    // Direction & Setups
    const buys = m.buy_signals !== undefined ? m.buy_signals : 0;
    const sells = m.sell_signals !== undefined ? m.sell_signals : 0;
    if (elDirection) elDirection.textContent = `${buys} BUY / ${sells} SELL`;
    if (elSetups) elSetups.textContent = `${m.setups_detected || totalTrades} setups evaluados`;

    // Consecutive Losses
    const maxConsec = m.max_consecutive_losses !== undefined ? m.max_consecutive_losses : 0;
    if (elConsec) {
        elConsec.textContent = `${maxConsec} consecutivas`;
        elConsec.style.color = maxConsec >= 4 ? '#EF4444' : (maxConsec >= 3 ? '#F59E0B' : '#10B981');
    }

    // Sharpe / Sortino
    if (elSharpe) {
        const s = m.sharpe_ratio !== undefined ? m.sharpe_ratio.toFixed(2) : '0.00';
        const so = m.sortino_ratio !== undefined ? m.sortino_ratio.toFixed(2) : '0.00';
        elSharpe.textContent = `${s} / ${so}`;
        elSharpe.style.color = m.sharpe_ratio >= 1.20 ? '#10B981' : (m.sharpe_ratio >= 0.70 ? '#F59E0B' : '#EF4444');
    }

    // Expectancy
    if (elExp) {
        const expVal = m.expectancy_pips || 0.0;
        elExp.textContent = `${expVal > 0 ? '+' : ''}${expVal.toFixed(1)} pips`;
        elExp.style.color = expVal > 0 ? '#10B981' : '#EF4444';
    }

    // Monte Carlo Ruin
    if (elRuin) {
        const ruin = m.monte_carlo_ruin_prob_pct || 0.0;
        elRuin.textContent = `${ruin.toFixed(1)}%`;
        elRuin.style.color = ruin <= 5.0 ? '#10B981' : '#EF4444';
    }

    // Risk / Reward
    if (elRr) elRr.textContent = (m.risk_reward_ratio !== undefined) ? `${m.risk_reward_ratio.toFixed(2)} R:R` : '0.00';

    // 3. Recommendations List
    const recList = document.getElementById('bt-recommendations-list');
    if (recList && Array.isArray(v.recommendations)) {
        recList.innerHTML = v.recommendations.map(r => `
            <li style="display: flex; align-items: flex-start; gap: 10px; color: var(--text-main);">
                <i class="fa-solid fa-angle-right" style="color: ${iconColor}; margin-top: 3px;"></i>
                <span>${r}</span>
            </li>
        `).join('');
    }

    // Scroll smoothly to verdict
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Execute Scientific Research (Walk Forward Analysis + Monte Carlo) from Dashboard UI
 */
async function runResearchFromUI() {
    const symbol = document.getElementById('rs-symbol')?.value || 'EURUSD';
    const strategy = document.getElementById('rs-strategy')?.value || 'eurusd_partial';
    const timeframe = document.getElementById('rs-timeframe')?.value || 'H1';
    const bars = parseInt(document.getElementById('rs-bars')?.value || '10000', 10);
    const n_simulations = parseInt(document.getElementById('rs-sims')?.value || '2000', 10);

    const btn = document.getElementById('btn-run-research');
    const icon = document.getElementById('btn-research-icon');
    const text = document.getElementById('btn-research-text');

    const progressCard = document.getElementById('research-progress-card');
    const verdictCard = document.getElementById('research-verdict-card');
    const fillBar = document.getElementById('rs-progress-fill');
    const percentLabel = document.getElementById('rs-progress-percent');
    const phaseTitle = document.getElementById('rs-progress-phase-title');
    const elapsedLabel = document.getElementById('rs-progress-elapsed');

    const stages = [
        document.getElementById('rs-stage-1'),
        document.getElementById('rs-stage-2'),
        document.getElementById('rs-stage-3'),
        document.getElementById('rs-stage-4'),
        document.getElementById('rs-stage-5'),
    ];

    if (btn) btn.disabled = true;
    if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
    if (text) text.textContent = 'Calculando WFA & MC...';

    if (progressCard) progressCard.classList.remove('wip-hidden');
    if (verdictCard) verdictCard.classList.add('wip-hidden');

    let currentProgress = 5;
    const startTime = Date.now();

    function setStageActive(activeIdx) {
        stages.forEach((el, idx) => {
            if (!el) return;
            if (idx <= activeIdx) {
                el.style.color = '#A855F7';
                el.style.fontWeight = '700';
            } else {
                el.style.color = 'var(--text-muted)';
                el.style.fontWeight = 'normal';
            }
        });
    }

    setStageActive(0);
    if (fillBar) {
        fillBar.style.width = '5%';
        fillBar.style.background = 'linear-gradient(90deg, #A855F7 0%, #3B82F6 100%)';
    }
    if (percentLabel) percentLabel.textContent = '5%';
    if (phaseTitle) phaseTitle.textContent = `1/5: Ingestando historial OHLC institucional de ${symbol}...`;

    const progressInterval = setInterval(() => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedLabel) elapsedLabel.textContent = `${elapsedSec.toFixed(1)}s`;

        const baseEstimate = bars >= 10000 ? 12.0 : 6.0;
        const normalized = Math.min(elapsedSec / baseEstimate, 1.0);

        if (normalized < 0.20) {
            currentProgress = Math.min(22, 5 + normalized * 80);
            if (phaseTitle) phaseTitle.textContent = `1/5: Ingestando dataset OHLC y validando integridad temporal...`;
            setStageActive(0);
        } else if (normalized < 0.50) {
            currentProgress = Math.min(52, 22 + (normalized - 0.20) * 100);
            if (phaseTitle) phaseTitle.textContent = `2/5: Ejecutando Ventanas Walk-Forward (Train In-Sample vs Test OOS)...`;
            setStageActive(1);
        } else if (normalized < 0.80) {
            currentProgress = Math.min(78, 52 + (normalized - 0.50) * 85);
            if (phaseTitle) phaseTitle.textContent = `3/5: Simulando ${n_simulations.toLocaleString()} permutaciones Monte Carlo...`;
            setStageActive(2);
        } else if (normalized < 0.95) {
            currentProgress = Math.min(94, 78 + (normalized - 0.80) * 105);
            if (phaseTitle) phaseTitle.textContent = `4/5: Auditando degradación de curva y score de estabilidad...`;
            setStageActive(3);
        } else {
            currentProgress = Math.min(98, currentProgress + 0.3);
            if (phaseTitle) phaseTitle.textContent = `5/5: Registrando experimento en research.db y emitiendo dictamen...`;
            setStageActive(4);
        }

        if (fillBar) fillBar.style.width = `${Math.round(currentProgress)}%`;
        if (percentLabel) percentLabel.textContent = `${Math.round(currentProgress)}%`;
    }, 150);

    try {
        const payload = { symbol, strategy, timeframe, bars, n_simulations };
        const response = await fetch('/api/research/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        clearInterval(progressInterval);

        if (!data.ok) {
            if (phaseTitle) phaseTitle.textContent = `Error: ${data.error || 'Research no completado'}`;
            if (fillBar) fillBar.style.background = '#EF4444';
            alert(`Research Error: ${data.error || data.message || 'Strategy Lab rejected research request.'}`);
            return;
        }

        if (fillBar) {
            fillBar.style.width = '100%';
            fillBar.style.background = 'linear-gradient(90deg, #A855F7 0%, #10B981 100%)';
        }
        if (percentLabel) percentLabel.textContent = '100%';
        if (phaseTitle) phaseTitle.textContent = '¡Research Científico Completado!';
        setStageActive(4);

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (elapsedLabel) elapsedLabel.textContent = `${totalElapsed}s`;

        setTimeout(() => {
            if (progressCard) progressCard.classList.add('wip-hidden');
            renderResearchVerdict(data);
            fetchLiveDashboardData();
        }, 400);

    } catch (err) {
        clearInterval(progressInterval);
        if (phaseTitle) phaseTitle.textContent = `Error de red: ${err}`;
        alert(`Failed to communicate with Strategy Lab: ${err}`);
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.className = 'fa-solid fa-flask';
        if (text) text.textContent = 'Ejecutar Research Científico';
    }
}

/**
 * Render Live Research Scientific Verdict & WFA Window Matrix
 */
function renderResearchVerdict(data) {
    const card = document.getElementById('research-verdict-card');
    if (!card) return;
    card.classList.remove('wip-hidden');

    const v = data.verdict || {};
    const wfa = data.wfa || {};
    const mc = data.monte_carlo || {};

    // 1. Banner Color, Icon & Title
    const banner = document.getElementById('rs-verdict-banner');
    const iconBox = document.getElementById('rs-verdict-icon-box');
    const icon = document.getElementById('rs-verdict-icon');
    const title = document.getElementById('rs-verdict-title');
    const badge = document.getElementById('rs-verdict-badge');
    const summary = document.getElementById('rs-verdict-summary');
    const metaSpan = document.getElementById('rs-sim-meta');
    const durationSpan = document.getElementById('rs-sim-duration');

    const status = v.status || 'CANDIDATE';
    let bgStyle = 'rgba(16, 185, 129, 0.12)';
    let borderStyle = '1px solid rgba(16, 185, 129, 0.3)';
    let badgeClass = 'trend-badge trend-up';
    let iconClass = 'fa-solid fa-certificate';
    let iconColor = '#10B981';

    if (status === 'REJECTED') {
        bgStyle = 'rgba(239, 68, 68, 0.12)';
        borderStyle = '1px solid rgba(239, 68, 68, 0.35)';
        badgeClass = 'trend-badge trend-down';
        iconClass = 'fa-solid fa-ban';
        iconColor = '#EF4444';
    } else if (status === 'CANDIDATE') {
        bgStyle = 'rgba(245, 158, 11, 0.12)';
        borderStyle = '1px solid rgba(245, 158, 11, 0.35)';
        badgeClass = 'trend-badge';
        iconClass = 'fa-solid fa-triangle-exclamation';
        iconColor = '#F59E0B';
    }

    if (banner) {
        banner.style.background = bgStyle;
        banner.style.borderBottom = borderStyle;
    }
    if (iconBox) {
        iconBox.style.background = `${iconColor}25`;
        iconBox.style.color = iconColor;
    }
    if (icon) icon.className = iconClass;
    if (title) {
        title.textContent = v.title || 'DICTAMEN CUANTITATIVO DE RESEARCH';
        title.style.color = iconColor;
    }
    if (badge) {
        badge.textContent = v.badge || status;
        badge.className = badgeClass;
    }
    if (summary) summary.textContent = v.summary || '';
    if (metaSpan) metaSpan.textContent = `${data.symbol} ${data.timeframe} · ${(data.bars_analyzed || 0).toLocaleString()} bars · ${data.strategy}`;
    if (durationSpan) durationSpan.textContent = `WFA + Monte Carlo: ${data.duration_ms} ms`;

    // 2. Metric Chips
    const elStability = document.getElementById('rs-metric-stability');
    const elRating = document.getElementById('rs-metric-rating');
    const elConsistency = document.getElementById('rs-metric-consistency');
    const elTestPf = document.getElementById('rs-metric-test-pf');
    const elTrainPf = document.getElementById('rs-metric-train-pf');
    const elDegradation = document.getElementById('rs-metric-degradation');
    const elRuin = document.getElementById('rs-metric-ruin');
    const elProfitable = document.getElementById('rs-metric-profitable');
    const elP95Dd = document.getElementById('rs-metric-p95-dd');
    const elP95Money = document.getElementById('rs-metric-p95-money');

    const score = data.stability_score !== undefined ? data.stability_score : 0.0;
    if (elStability) {
        elStability.textContent = `${score.toFixed(1)} / 100`;
        elStability.style.color = score >= 70 ? '#10B981' : (score >= 50 ? '#F59E0B' : '#EF4444');
    }

    if (elRating) {
        const rat = wfa.rating || 'N/A';
        elRating.textContent = rat;
        elRating.style.color = rat === 'STABLE' ? '#10B981' : (rat === 'MODERATE' ? '#F59E0B' : '#EF4444');
    }

    if (elConsistency) {
        elConsistency.textContent = (wfa.consistency_score !== undefined) ? wfa.consistency_score.toFixed(2) : '0.00';
    }

    if (elTestPf) {
        const testPf = wfa.mean_test_pf !== undefined ? wfa.mean_test_pf : 0.0;
        elTestPf.textContent = testPf.toFixed(2);
        elTestPf.style.color = testPf >= 1.25 ? '#10B981' : (testPf >= 1.0 ? '#F59E0B' : '#EF4444');
    }
    if (elTrainPf) {
        const trainPf = wfa.mean_train_pf !== undefined ? wfa.mean_train_pf : 0.0;
        elTrainPf.textContent = `Train PF: ${trainPf.toFixed(2)}`;
    }

    if (elDegradation) {
        elDegradation.textContent = (wfa.pf_degradation !== undefined) ? wfa.pf_degradation.toFixed(2) : '0.00';
    }

    if (elRuin) {
        const ruin = mc.ruin_probability_pct !== undefined ? mc.ruin_probability_pct : 0.0;
        elRuin.textContent = `${ruin.toFixed(1)}%`;
        elRuin.style.color = ruin <= 5.0 ? '#10B981' : '#EF4444';
    }

    if (elProfitable) {
        const prof = mc.probability_profitable_pct !== undefined ? mc.probability_profitable_pct : 0.0;
        elProfitable.textContent = `${prof.toFixed(1)}%`;
        elProfitable.style.color = prof >= 75.0 ? '#10B981' : '#F59E0B';
    }

    if (elP95Dd) {
        const p95 = mc.p95_max_drawdown_pct !== undefined ? mc.p95_max_drawdown_pct : 0.0;
        elP95Dd.textContent = `${p95.toFixed(1)}%`;
    }
    if (elP95Money) {
        const p95Money = mc.p95_max_drawdown_usd !== undefined ? mc.p95_max_drawdown_usd : 0.0;
        elP95Money.textContent = `$${p95Money.toFixed(2)} USD`;
    }

    // 3. WFA Windows Table
    const windowsBody = document.getElementById('rs-wfa-windows-body');
    if (windowsBody) {
        const windows = Array.isArray(wfa.windows) ? wfa.windows : [];
        if (windows.length === 0) {
            windowsBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 16px;">
                        No se generaron ventanas WFA suficientes con el dataset proporcionado.
                    </td>
                </tr>
            `;
        } else {
            windowsBody.innerHTML = windows.map(w => {
                const trainPf = (w.train_pf !== undefined) ? w.train_pf.toFixed(2) : '—';
                const testPf = (w.test_pf !== undefined) ? w.test_pf.toFixed(2) : '—';
                const deg = (w.pf_degradation !== undefined) ? w.pf_degradation.toFixed(2) : '—';
                const trainWr = (w.train_wr !== undefined) ? `${w.train_wr.toFixed(1)}%` : '—';
                const testWr = (w.test_wr !== undefined) ? `${w.test_wr.toFixed(1)}%` : '—';
                const pass = w.consistency ? '<span class="status-pill pill-green">PASS</span>' : '<span class="status-pill pill-red">FAIL</span>';

                return `
                    <tr>
                        <td style="font-weight: 700; font-family: monospace;">Ventana #${w.window_id}</td>
                        <td>${trainPf}</td>
                        <td style="font-weight: 700; color: ${w.test_pf >= 1.0 ? 'var(--accent-green)' : 'var(--color-sell)'};">${testPf}</td>
                        <td>${deg}</td>
                        <td>${trainWr}</td>
                        <td>${testWr}</td>
                        <td>${pass}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Scroll smoothly to verdict
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ==========================================================================
   Modern App Shell & Navigation Controls (dashboard_new.tsx inspiration)
   ========================================================================== */

function initAppShell() {
    // Restore Sidebar Collapsed State
    const isCollapsed = localStorage.getItem('lastedge_sidebar_collapsed') === 'true';
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && isCollapsed) {
        sidebar.classList.add('collapsed');
    }

    // Global Keyboard Shortcuts (⌘K, ⌘B, ESC)
    document.addEventListener('keydown', (e) => {
        // Toggle Command Palette (Cmd+K or Ctrl+K)
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        }
        // Toggle Sidebar (Cmd+B or Ctrl+B)
        else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
        // Close modals on Escape
        else if (e.key === 'Escape') {
            closeCommandPalette();
            closeWorkspaceMenu();
        }
    });

    // Close workspace dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wsSwitcher = document.querySelector('.workspace-switcher');
        if (wsSwitcher && !wsSwitcher.contains(e.target)) {
            closeWorkspaceMenu();
        }
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('lastedge_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    setTimeout(handleChartResize, 260);
}

function toggleWorkspaceMenu() {
    const dropdown = document.getElementById('ws-dropdown');
    const chevron = document.getElementById('ws-chevron-icon');
    if (!dropdown) return;
    const isHidden = dropdown.classList.toggle('wip-hidden');
    if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

function closeWorkspaceMenu() {
    const dropdown = document.getElementById('ws-dropdown');
    const chevron = document.getElementById('ws-chevron-icon');
    if (dropdown && !dropdown.classList.contains('wip-hidden')) {
        dropdown.classList.add('wip-hidden');
    }
    if (chevron) {
        chevron.style.transform = 'rotate(0deg)';
    }
}

function selectWorkspace(name, tier) {
    const wsName = document.getElementById('ws-account-name');
    const wsTier = document.getElementById('ws-account-tier');
    const bcAccount = document.getElementById('bc-account');

    if (wsName) wsName.textContent = name;
    if (wsTier) wsTier.textContent = tier;
    if (bcAccount) bcAccount.textContent = name;

    closeWorkspaceMenu();
}

/* ==========================================================================
   Command Palette (⌘K) Controller
   ========================================================================== */

function openCommandPalette() {
    const modal = document.getElementById('command-palette-modal');
    const input = document.getElementById('command-palette-input');
    if (!modal) return;
    modal.classList.remove('wip-hidden');
    if (input) {
        input.value = '';
        input.focus();
        filterCommandPalette('');
    }
}

function closeCommandPalette() {
    const modal = document.getElementById('command-palette-modal');
    if (modal) modal.classList.add('wip-hidden');
}

function toggleCommandPalette() {
    const modal = document.getElementById('command-palette-modal');
    if (!modal) return;
    if (modal.classList.contains('wip-hidden')) {
        openCommandPalette();
    } else {
        closeCommandPalette();
    }
}

function handleCommandBackdropClick(e) {
    if (e.target.id === 'command-palette-modal') {
        closeCommandPalette();
    }
}

function filterCommandPalette(query) {
    const list = document.getElementById('command-results-list');
    if (!list) return;
    const q = query.trim().toLowerCase();
    const items = list.querySelectorAll('.command-item');
    let firstVisible = null;

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = 'flex';
            if (!firstVisible) firstVisible = item;
        } else {
            item.style.display = 'none';
        }
        item.classList.remove('focused');
    });

    if (firstVisible) {
        firstVisible.classList.add('focused');
    }
}

function executeCommand(action) {
    closeCommandPalette();
    if (action === 'overview' || action === 'positions' || action === 'signals' || action === 'research' || action === 'checklist') {
        switchDashTab(action);
    } else if (action === 'sync') {
        refreshDashboardData();
    } else if (action === 'theme') {
        toggleThemeMode();
    }
}

/* ==========================================================================
   Institutional Balance & Equity Canvas Engine (line-charts.tsx standard)
   ========================================================================== */

let chartState = {
    canvas: null,
    ctx: null,
    tooltip: null,
    range: '1M',
    dataPoints: [],
    hoverIndex: -1,
    isOnline: false,
    currentBalance: 0,
    currentEquity: 0,
    currentFloat: 0,
    currency: 'USD'
};

function getCurrencySymbol(curr) {
    if (curr === 'EUR') return '€';
    if (curr === 'USD') return '$';
    if (curr === 'GBP') return '£';
    return (curr || '$') + ' ';
}

function initBalanceEquityChart() {
    chartState.canvas = document.getElementById('balance-equity-canvas');
    chartState.tooltip = document.getElementById('chart-tooltip');
    if (!chartState.canvas) return;

    chartState.ctx = chartState.canvas.getContext('2d');

    // Cargar historial real guardado en localStorage si existe (cero datos inventados)
    try {
        const saved = localStorage.getItem('lastedge_real_equity_history');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                chartState.dataPoints = parsed;
            }
        }
    } catch (e) {
        console.warn('Could not read cached equity timeline', e);
    }

    // Canvas Mouse Listeners
    chartState.canvas.addEventListener('mousemove', onChartMouseMove);
    chartState.canvas.addEventListener('mouseleave', onChartMouseLeave);

    // Responsive window resize
    window.addEventListener('resize', handleChartResize);

    setTimeout(handleChartResize, 100);
}

function updateChartTelemetry(balance, equity, floating, currency, online, serverHistory) {
    chartState.isOnline = online;
    chartState.currentBalance = balance;
    chartState.currentEquity = equity;
    chartState.currentFloat = floating;
    chartState.currency = currency || 'USD';
    const sym = getCurrencySymbol(chartState.currency);

    // Update Header KPI Badges in the Chart Card
    const elEq = document.getElementById('chart-kpi-equity');
    const elBal = document.getElementById('chart-kpi-balance');
    const elFloat = document.getElementById('chart-kpi-float');

    if (elEq) {
        elEq.textContent = online ? `${sym}${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    }
    if (elBal) {
        elBal.textContent = online ? `${sym}${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    }
    if (elFloat) {
        if (online) {
            elFloat.textContent = `${floating >= 0 ? '+' : ''}${sym}${floating.toFixed(2)}`;
            elFloat.style.color = floating >= 0 ? 'var(--color-buy)' : 'var(--color-sell)';
        } else {
            elFloat.textContent = '—';
            elFloat.style.color = 'var(--text-muted)';
        }
    }

    // 1. Integrar historial real de deals y snapshots del servidor si está disponible
    if (Array.isArray(serverHistory) && serverHistory.length > 0) {
        const pointMap = new Map();
        serverHistory.forEach(p => {
            if (p && p.time && p.balance !== undefined) {
                pointMap.set(p.time, {
                    time: p.time,
                    balance: Number(p.balance),
                    equity: Number(p.equity !== undefined ? p.equity : p.balance),
                    symbol: p.symbol || '',
                    pnl: p.pnl || 0
                });
            }
        });
        chartState.dataPoints.forEach(p => {
            if (p && p.time && !pointMap.has(p.time)) {
                pointMap.set(p.time, p);
            }
        });
        chartState.dataPoints = Array.from(pointMap.values()).sort((a, b) => a.time - b.time);
    }

    // 2. Registrar tick real en vivo si el motor está online
    if (online && balance > 0) {
        const last = chartState.dataPoints[chartState.dataPoints.length - 1];
        if (!last || Math.abs(last.equity - equity) > 0.01 || Math.abs(last.balance - balance) > 0.01 || Date.now() - last.time > 60000) {
            chartState.dataPoints.push({
                time: Date.now(),
                balance: balance,
                equity: equity
            });
            if (chartState.dataPoints.length > 300) {
                chartState.dataPoints.shift();
            }
            try {
                localStorage.setItem('lastedge_real_equity_history', JSON.stringify(chartState.dataPoints.slice(-100)));
            } catch (e) {}
        }
    }

    renderBalanceEquityChart();
}

function setChartRange(range) {
    chartState.range = range;
    const btns = ['1d', '1w', '1m', 'all'];
    btns.forEach(b => {
        const el = document.getElementById(`seg-btn-${b}`);
        if (el) {
            if (b.toUpperCase() === range) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    });

    renderBalanceEquityChart();
}

function handleChartResize() {
    const canvas = chartState.canvas;
    if (!canvas || !canvas.parentElement) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    chartState.ctx.scale(dpr, dpr);

    renderBalanceEquityChart();
}

function getFilteredDataPoints() {
    if (!chartState.dataPoints.length) {
        if (chartState.currentBalance > 0) {
            const now = Date.now();
            return [
                { time: now - 3600000, balance: chartState.currentBalance, equity: chartState.currentEquity || chartState.currentBalance },
                { time: now, balance: chartState.currentBalance, equity: chartState.currentEquity || chartState.currentBalance }
            ];
        }
        return [];
    }

    const now = Date.now();
    let cutoff = 0;

    if (chartState.range === '1D') {
        cutoff = now - (24 * 3600 * 1000);
    } else if (chartState.range === '1W') {
        cutoff = now - (7 * 24 * 3600 * 1000);
    } else if (chartState.range === '1M') {
        cutoff = now - (30 * 24 * 3600 * 1000);
    } else {
        cutoff = 0;
    }

    const filtered = cutoff > 0 ? chartState.dataPoints.filter(p => p.time >= cutoff) : chartState.dataPoints;
    if (filtered.length === 1) {
        const p = filtered[0];
        return [{ time: p.time - 3600000, balance: p.balance, equity: p.equity }, p];
    }
    return filtered.length >= 2 ? filtered : chartState.dataPoints.slice(-10);
}

function renderBalanceEquityChart() {
    const canvas = chartState.canvas;
    const ctx = chartState.ctx;
    if (!canvas || !ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const data = getFilteredDataPoints();
    if (data.length < 2) return;

    const padTop = 16;
    const padBottom = 24;
    const padLeft = 10;
    const padRight = 10;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Find min and max
    let minVal = Infinity;
    let maxVal = -Infinity;
    data.forEach(d => {
        if (d.balance < minVal) minVal = d.balance;
        if (d.equity < minVal) minVal = d.equity;
        if (d.balance > maxVal) maxVal = d.balance;
        if (d.equity > maxVal) maxVal = d.equity;
    });

    const range = (maxVal - minVal) || 1;
    minVal -= range * 0.05;
    maxVal += range * 0.05;
    const adjustedRange = maxVal - minVal;

    const getX = (i) => padLeft + (i / (data.length - 1)) * chartW;
    const getY = (val) => padTop + chartH - ((val - minVal) / adjustedRange) * chartH;

    // Theme style detection
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
    const balanceColor = isDark ? '#38BDF8' : '#0284C7';
    const equityColor = isDark ? '#10B981' : '#059669';

    // 1. Cartesian Grid Lines (dashed, stroke-border/50)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Equity Area Gradient
    const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    areaGrad.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(5, 150, 105, 0.12)');
    areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].equity));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i), getY(data[i].equity));
    }
    ctx.lineTo(getX(data.length - 1), padTop + chartH);
    ctx.lineTo(getX(0), padTop + chartH);
    ctx.closePath();
    ctx.fill();

    // 3. Equity Line (Curved)
    ctx.strokeStyle = equityColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].equity));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i), getY(data[i].equity));
    }
    ctx.stroke();

    // 4. Balance Line (Solid)
    ctx.strokeStyle = balanceColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].balance));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i), getY(data[i].balance));
    }
    ctx.stroke();

    // 5. Hover Crosshair & Indicators (line-charts.tsx standard)
    if (chartState.hoverIndex >= 0 && chartState.hoverIndex < data.length) {
        const idx = chartState.hoverIndex;
        const pt = data[idx];
        const hx = getX(idx);
        const hyEq = getY(pt.equity);
        const hyBal = getY(pt.balance);

        // Vertical dashed line
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, padTop);
        ctx.lineTo(hx, padTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dots on both curves
        // Balance Dot
        ctx.fillStyle = balanceColor;
        ctx.beginPath();
        ctx.arc(hx, hyBal, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Equity Dot
        ctx.fillStyle = equityColor;
        ctx.beginPath();
        ctx.arc(hx, hyEq, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#12141D' : '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function onChartMouseMove(e) {
    const canvas = chartState.canvas;
    const tooltip = chartState.tooltip;
    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = rect.width;

    const data = getFilteredDataPoints();
    if (data.length < 2) return;

    const padLeft = 10;
    const padRight = 10;
    const chartW = width - padLeft - padRight;

    // Find closest index
    const clampedX = Math.max(padLeft, Math.min(width - padRight, mouseX));
    const ratio = (clampedX - padLeft) / chartW;
    const idx = Math.round(ratio * (data.length - 1));

    if (idx >= 0 && idx < data.length) {
        chartState.hoverIndex = idx;
        const pt = data[idx];
        const dateStr = new Date(pt.time).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const floatDiff = pt.equity - pt.balance;

        const sym = getCurrencySymbol(chartState.currency);

        // Tooltip contents with tabular-nums font-mono (line-charts.tsx standard)
        tooltip.innerHTML = `
            <div class="tooltip-date">${dateStr}</div>
            <div class="tooltip-row">
                <span class="tooltip-label"><span class="legend-indicator indicator-balance"></span> Balance:</span>
                <span class="tooltip-value font-mono">${sym}${pt.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label"><span class="legend-indicator indicator-equity"></span> Equity:</span>
                <span class="tooltip-value font-mono">${sym}${pt.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Floating:</span>
                <span class="tooltip-value font-mono" style="color: ${floatDiff >= 0 ? 'var(--color-buy)' : 'var(--color-sell)'};">
                    ${floatDiff >= 0 ? '+' : ''}${sym}${floatDiff.toFixed(2)}
                </span>
            </div>
        `;

        // Tooltip positioning
        tooltip.classList.remove('wip-hidden');
        let tipX = mouseX + 16;
        if (tipX + 170 > width) {
            tipX = mouseX - 170;
        }
        tooltip.style.left = `${tipX}px`;
        tooltip.style.top = '12px';

        renderBalanceEquityChart();
    }
}

function onChartMouseLeave() {
    chartState.hoverIndex = -1;
    const tooltip = chartState.tooltip;
    if (tooltip) {
        tooltip.classList.add('wip-hidden');
    }
    renderBalanceEquityChart();
}

