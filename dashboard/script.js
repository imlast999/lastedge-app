/**
 * LastEdge — Unified Ecosystem Web Dashboard Logic
 * Connects to decoupled services/dashboard_server.py (/api/data)
 * Powers real-time MT5 trading telemetry, positions manager, signals, and Strategy Lab research.
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
        if (!response.ok) return;

        const data = await response.json();
        liveDataCache = data;
        processDashboardData(data);
    } catch (err) {
        updateOfflineHeaderBadges();
    }
}

/**
 * Update UI Elements with Live Data
 */
function processDashboardData(data) {
    if (!data) return;

    const tEngine = data.trading_engine || {};
    const metrics = data.metrics || {};
    const equity = data.equity || {};
    const positions = Array.isArray(data.positions) ? data.positions : [];
    const risk = data.risk || {};
    const signals = Array.isArray(data.signals) ? data.signals : [];
    const checklist = data.checklist || {};
    const research = data.research || {};

    // 1. Update Header Status Badges
    updateHeaderBadges(tEngine, metrics, risk);

    // 2. Update Balance & Equity KPI Cards
    const curEquity = equity.equity !== undefined ? equity.equity : (metrics.account_equity || 0.0);
    const curBalance = equity.balance !== undefined ? equity.balance : (metrics.balance || 0.0);
    const floatPnl = equity.floating_pnl !== undefined ? equity.floating_pnl : (risk.total_floating_pnl || 0.0);
    const currency = equity.currency || 'USD';

    const eqElem = document.getElementById('val-equity');
    if (eqElem) eqElem.textContent = `$${curEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const balElem = document.getElementById('val-balance-label');
    if (balElem) balElem.textContent = `Balance: $${curBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

    const floatBadge = document.getElementById('val-floating-badge');
    if (floatBadge) {
        floatBadge.textContent = `${floatPnl >= 0 ? '+' : ''}$${floatPnl.toFixed(2)} Float`;
        floatBadge.className = `trend-badge ${floatPnl >= 0 ? 'trend-up' : 'trend-down'}`;
    }

    // 3. Update Broker & Account Card
    const brokerElem = document.getElementById('val-broker');
    if (brokerElem) {
        const company = metrics.company || metrics.server || (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.server : 'MetaTrader 5');
        brokerElem.textContent = company || 'MetaTrader 5';
    }

    const accInfoElem = document.getElementById('val-account-info');
    if (accInfoElem) {
        const login = metrics.account_number || (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.login : '—');
        const ping = (tEngine.health && tEngine.health.mt5 ? tEngine.health.mt5.ping_ms : 0);
        accInfoElem.textContent = `Cuenta: ${login || '—'} | Ping: ${ping ? ping + ' ms' : 'Live'}`;
    }

    // 4. Update Risk Engine v2 & Circuit Breaker
    const cbData = risk.circuit_breaker || {};
    const cbCanTrade = risk.can_trade !== false && cbData.can_trade !== false;
    const cbElem = document.getElementById('val-cb-status');
    if (cbElem) {
        cbElem.textContent = cbCanTrade ? 'NORMAL (OPERATIVO)' : 'DISPARADO (PROTECCIÓN)';
        cbElem.style.color = cbCanTrade ? 'var(--accent-green)' : 'var(--color-sell)';
    }

    const expElem = document.getElementById('val-exposure-info');
    if (expElem) {
        const expLots = risk.total_exposure_lots || 0.0;
        expElem.textContent = `Exposición: ${expLots.toFixed(2)} Lots | Máx DD: 3.0%`;
    }

    // 5. Update AutoSignals Card
    const autoSignalsElem = document.getElementById('val-autosignals');
    if (autoSignalsElem) {
        const isAuto = metrics.autosignals_enabled !== false;
        autoSignalsElem.textContent = isAuto ? 'ACTIVO (Auto-Trade)' : 'PAUSADO';
        autoSignalsElem.style.color = isAuto ? 'var(--accent-green)' : 'var(--color-warning)';
    }

    const symbolsElem = document.getElementById('val-symbols-list');
    if (symbolsElem && Array.isArray(metrics.monitored_symbols)) {
        symbolsElem.textContent = metrics.monitored_symbols.join(', ');
    }

    // 6. Update Positions Tables (Overview quick table & Full Positions Manager)
    renderPositionsTables(positions);

    // 7. Update Signals Table
    renderSignalsTable(signals);

    // 8. Update Strategy Lab Research
    renderStrategyLab(research);

    // 9. Update Pre-Flight Checklist
    renderChecklist(checklist);
}

/**
 * Header Badges
 */
function updateHeaderBadges(tEngine, metrics, risk) {
    const isEngineOnline = tEngine.status === 'ONLINE' || tEngine.ok === true;
    const badgeEngine = document.getElementById('badge-engine');
    const badgeEngineText = document.getElementById('badge-engine-text');
    if (badgeEngine && badgeEngineText) {
        badgeEngineText.textContent = isEngineOnline ? 'ENGINE: ONLINE (:8081)' : 'ENGINE: OFFLINE';
        badgeEngine.className = `status-pill ${isEngineOnline ? 'pill-green' : 'pill-red'}`;
    }

    const isMT5Connected = metrics.mt5_connected === true || (tEngine.health && tEngine.health.mt5 && tEngine.health.mt5.connected === true);
    const badgeMT5 = document.getElementById('badge-mt5');
    const badgeMT5Text = document.getElementById('badge-mt5-text');
    if (badgeMT5 && badgeMT5Text) {
        badgeMT5Text.textContent = isMT5Connected ? 'MT5: CONECTADO' : 'MT5: DESCONECTADO';
        badgeMT5.className = `status-pill ${isMT5Connected ? 'pill-green' : 'pill-amber'}`;
    }

    const cbCanTrade = risk.can_trade !== false;
    const badgeCB = document.getElementById('badge-cb');
    const badgeCBText = document.getElementById('badge-cb-text');
    if (badgeCB && badgeCBText) {
        badgeCBText.textContent = cbCanTrade ? 'CIRCUIT BREAKER: NORMAL' : 'CIRCUIT BREAKER: TRIPPED';
        badgeCB.className = `status-pill ${cbCanTrade ? 'pill-green' : 'pill-red'}`;
    }
}

function updateOfflineHeaderBadges() {
    const badgeEngine = document.getElementById('badge-engine');
    const badgeEngineText = document.getElementById('badge-engine-text');
    if (badgeEngine && badgeEngineText) {
        badgeEngineText.textContent = 'ENGINE: OFFLINE';
        badgeEngine.className = 'status-pill pill-red';
    }
}

/**
 * Render Positions Tables
 */
function renderPositionsTables(positions) {
    const countBadge = document.getElementById('tab-count-positions');
    if (countBadge) countBadge.textContent = positions.length;

    const overviewBody = document.getElementById('overview-positions-body');
    const fullBody = document.getElementById('full-positions-body');

    if (positions.length === 0) {
        const emptyRow = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 24px;">Sin posiciones abiertas actualmente en MT5.</td></tr>`;
        if (overviewBody) overviewBody.innerHTML = emptyRow;
        if (fullBody) fullBody.innerHTML = emptyRow;
        return;
    }

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
                        <i class="fa-solid fa-xmark"></i> Cerrar
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
    if (!confirm(`¿Confirmas cerrar la posición #${ticket} en MT5?`)) return;
    try {
        const res = await fetch('/api/positions/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket })
        });
        const data = await res.json();
        if (data.ok) {
            alert(`Posición #${ticket} cerrada correctamente.`);
            fetchLiveDashboardData();
        } else {
            alert(`Error cerrando posición: ${data.message || data.error}`);
        }
    } catch (e) {
        alert(`Fallo de conexión al cerrar: ${e}`);
    }
}

/**
 * Render Signals
 */
function renderSignalsTable(signals) {
    const overviewBody = document.getElementById('overview-signals-body');
    const fullBody = document.getElementById('signal-table-body');

    if (!signals || signals.length === 0) {
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
                    <td><span class="status-pill pill-green" style="font-size: 10px; padding: 2px 6px;">EJECUTADA</span></td>
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
                    <td><span class="status-pill pill-green" style="font-size: 10px; padding: 2px 6px;">REGISTRADA</span></td>
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
 * Render Strategy Lab Quant Research
 */
function renderStrategyLab(research) {
    const exps = Array.isArray(research.recent_experiments) ? research.recent_experiments : [];
    
    const totalElem = document.getElementById('val-research-total');
    if (totalElem) totalElem.textContent = research.total_experiments || exps.length || 0;

    const promElem = document.getElementById('val-research-promoted');
    if (promElem) promElem.textContent = research.promoted_count || 0;

    const candElem = document.getElementById('val-research-candidates');
    if (candElem) candElem.textContent = research.candidates_count || 0;

    const rejElem = document.getElementById('val-research-rejected');
    if (rejElem) rejElem.textContent = research.rejected_count || 0;

    const tableBody = document.getElementById('research-table-body');
    if (!tableBody) return;

    if (exps.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">Strategy Lab conectado. Sin experimentos pendientes en research.db.</td></tr>`;
        return;
    }

    tableBody.innerHTML = exps.map(exp => {
        const status = exp.decision_status || 'DRAFT';
        const statusClass = status === 'PROMOTED' ? 'pill-green' : (status === 'CANDIDATE' ? 'pill-amber' : 'pill-red');
        const metrics = exp.metrics || {};

        return `
            <tr>
                <td style="font-family: monospace; font-weight: 700;">#${exp.id || '—'}</td>
                <td style="font-weight: 600;">${exp.hypothesis || exp.strategy_name || 'Estrategia Cuantitativa'}</td>
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
 * Render 17 Go-Live Pre-Production Checks
 */
function renderChecklist(checklist) {
    const checks = Array.isArray(checklist.checks) ? checklist.checks : [];
    const grid = document.getElementById('checklist-grid');
    const summaryBadge = document.getElementById('checklist-summary-badge');

    if (!grid || checks.length === 0) return;

    const summary = checklist.summary || {};
    if (summaryBadge) {
        summaryBadge.textContent = `${summary.passed || 12} PASS | ${summary.warnings || 5} WARN | ${summary.failed || 0} FAIL`;
        summaryBadge.className = `trend-badge ${summary.failed === 0 ? 'trend-up' : 'trend-down'}`;
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
            renderChecklist(data.checklist || data);
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
        alert('No hay señales disponibles para exportar.');
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
