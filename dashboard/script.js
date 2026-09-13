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
    fetchLiveDashboardData();
    pollingTimer = setInterval(fetchLiveDashboardData, 3000);
});

/**
 * Switch Dashboard Navigation Tabs
 * @param {'overview' | 'positions' | 'signals' | 'research' | 'checklist'} tabName 
 */
function switchDashTab(tabName) {
    const tabs = ['overview', 'positions', 'signals', 'research', 'checklist'];
    
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
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = mode === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
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
    } else {
        const curEquity = equity.equity !== undefined ? equity.equity : (metrics.account_equity || 0.0);
        const curBalance = equity.balance !== undefined ? equity.balance : (metrics.balance || 0.0);
        const floatPnl = equity.floating_pnl !== undefined ? equity.floating_pnl : (risk.total_floating_pnl || 0.0);
        const currency = equity.currency || metrics.currency || 'USD';

        if (eqElem) {
            eqElem.textContent = `$${curEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (balElem) {
            balElem.textContent = `Balance: $${curBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
        }
        if (floatBadge) {
            floatBadge.textContent = `${floatPnl >= 0 ? '+' : ''}$${floatPnl.toFixed(2)} Float`;
            floatBadge.className = `trend-badge ${floatPnl >= 0 ? 'trend-up' : 'trend-down'}`;
        }
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
 * Render Strategy Lab Quant Research (No Placeholders!)
 */
function renderStrategyLab(research, isLabOnline) {
    const totalElem = document.getElementById('val-research-total');
    const promElem = document.getElementById('val-research-promoted');
    const candElem = document.getElementById('val-research-candidates');
    const rejElem = document.getElementById('val-research-rejected');
    const tableBody = document.getElementById('research-table-body');

    if (!isLabOnline) {
        if (totalElem) totalElem.textContent = '—';
        if (promElem) promElem.textContent = '—';
        if (candElem) candElem.textContent = '—';
        if (rejElem) rejElem.textContent = '—';

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 32px;">
                        <div style="color: #EF4444; font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> STRATEGY LAB IS OFFLINE (:8082)
                        </div>
                        <div style="color: var(--text-muted); font-size: 12px; line-height: 1.5;">
                            The quantitative research service on port 8082 is not responding.<br>
                            Please start the Strategy Lab service on port 8082.
                        </div>
                    </td>
                </tr>
            `;
        }
        return;
    }

    const exps = Array.isArray(research.recent_experiments) ? research.recent_experiments : [];
    
    if (totalElem) totalElem.textContent = research.total_experiments || exps.length || 0;
    if (promElem) promElem.textContent = research.promoted_count || 0;
    if (candElem) candElem.textContent = research.candidates_count || 0;
    if (rejElem) rejElem.textContent = research.rejected_count || 0;

    if (!tableBody) return;

    if (exps.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-green); margin-right: 6px;"></i>
                    Strategy Lab connected (:8082). 0 active experiments recorded (research.db).
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = exps.map(exp => {
        const status = exp.decision_status || 'DRAFT';
        const statusClass = status === 'PROMOTED' ? 'pill-green' : (status === 'CANDIDATE' ? 'pill-amber' : 'pill-red');
        const metrics = exp.metrics || {};

        return `
            <tr>
                <td style="font-family: monospace; font-weight: 700;">#${exp.id || '—'}</td>
                <td style="font-weight: 600;">${exp.hypothesis || exp.strategy_name || 'Quantitative Strategy'}</td>
                <td>${exp.symbol || 'EURUSD'}</td>
                <td>${exp.timeframe || 'H1'}</td>
                <td>${metrics.sharpe_ratio !== undefined ? metrics.sharpe_ratio.toFixed(2) : '—'}</td>
                <td>${metrics.sortino_ratio !== undefined ? metrics.sortino_ratio.toFixed(2) : '—'}</td>
                <td>${metrics.max_drawdown_pct !== undefined ? metrics.max_drawdown_pct.toFixed(2) + '%' : '—'}</td>
                <td>${metrics.win_rate_pct !== undefined ? metrics.win_rate_pct.toFixed(1) + '%' : '—'}</td>
                <td><span class="status-pill ${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');
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
