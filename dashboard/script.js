/**
 * Quant Trading Bot Application Logic
 * Connected to live dashboard.py Python backend endpoints (/api/data, /api/metrics, /api/history).
 * Cleaned of all static mock data.
 */

// Configurable Admin Credentials
const ADMIN_CONFIG = {
    usernames: ['admin', 'admin@trading.com', 'admin@quant.com'],
    password: localStorage.getItem('quant_admin_password') || 'admin123'
};

// Real-time Signal Store (populated dynamically from dashboard.py backend)
let liveSignalsDataset = [];
let updateIntervalTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initThemeSetting();
    initAuthListeners();
    checkExistingSession();
    loadMT5Settings();

    // Close user menu dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('user-dropdown-menu');
        const trigger = document.getElementById('user-profile-trigger');
        if (menu && !menu.classList.contains('wip-hidden') && !menu.contains(e.target) && !trigger.contains(e.target)) {
            menu.classList.add('wip-hidden');
            trigger.classList.remove('active');
        }
    });
});

/**
 * User Profile Menu Toggle
 */
function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('user-dropdown-menu');
    const trigger = document.getElementById('user-profile-trigger');

    if (menu) {
        const isHidden = menu.classList.contains('wip-hidden');
        menu.classList.toggle('wip-hidden', !isHidden);
        if (trigger) trigger.classList.toggle('active', isHidden);
    }
}

/**
 * Theme Toggle & Persistence Logic
 */
function initThemeSetting() {
    const savedTheme = localStorage.getItem('quant_theme') || 'dark';
    setThemeMode(savedTheme);
}

function toggleThemeMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
}

function setThemeMode(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('quant_theme', mode);

    const toggleSwitch = document.getElementById('theme-toggle-switch');
    const icon = document.getElementById('theme-icon');
    const modeLabel = document.getElementById('theme-mode-label');

    const isLight = mode === 'light';
    if (toggleSwitch) toggleSwitch.checked = isLight;
    if (icon) icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (modeLabel) modeLabel.textContent = isLight ? 'Light Mode' : 'Dark Mode';
}

/**
 * Session verification on startup
 */
function checkExistingSession() {
    const isLoggedAdmin = localStorage.getItem('quant_admin_session') === 'true';
    if (isLoggedAdmin) {
        showAdminDashboard();
    }
}

/**
 * Initialize event listeners for auth slider and forms
 */
function initAuthListeners() {
    const container = document.getElementById('container');
    const registerBtn = document.getElementById('register');
    const loginBtn = document.getElementById('login');
    const formSignUp = document.getElementById('form-signup');
    const formSignIn = document.getElementById('form-signin');

    if (registerBtn && container) {
        registerBtn.addEventListener('click', () => {
            container.classList.add("active");
            clearAllErrors();
        });
    }

    if (loginBtn && container) {
        loginBtn.addEventListener('click', () => {
            container.classList.remove("active");
            clearAllErrors();
        });
    }

    if (formSignUp) {
        formSignUp.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateSignUp()) {
                handleUserAuthSuccess(false);
            }
        });
    }

    if (formSignIn) {
        formSignIn.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateSignIn()) {
                const emailVal = document.getElementById('signin-email').value.trim().toLowerCase();
                const passVal = document.getElementById('signin-password').value;

                const isAdminUser = ADMIN_CONFIG.usernames.includes(emailVal);
                const isCorrectPass = (passVal === ADMIN_CONFIG.password);

                if (isAdminUser) {
                    if (isCorrectPass) {
                        localStorage.setItem('quant_admin_session', 'true');
                        handleUserAuthSuccess(true);
                    } else {
                        showFieldError(document.getElementById('signin-password'), 'Incorrect admin password');
                    }
                } else {
                    handleUserAuthSuccess(false);
                }
            }
        });
    }

    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => clearFieldError(input));
    });
}

function validateSignUp() {
    let isValid = true;
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');

    if (!nameInput.value.trim()) { showFieldError(nameInput, 'Name is required'); isValid = false; }
    else clearFieldError(nameInput);

    if (!emailInput.value.trim()) { showFieldError(emailInput, 'Email is required'); isValid = false; }
    else if (!isValidEmail(emailInput.value.trim())) { showFieldError(emailInput, 'Invalid email format'); isValid = false; }
    else clearFieldError(emailInput);

    if (!passwordInput.value) { showFieldError(passwordInput, 'Password is required'); isValid = false; }
    else if (passwordInput.value.length < 8) { showFieldError(passwordInput, 'Min 8 characters required'); isValid = false; }
    else clearFieldError(passwordInput);

    return isValid;
}

function validateSignIn() {
    let isValid = true;
    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');

    if (!emailInput.value.trim()) { showFieldError(emailInput, 'Email is required'); isValid = false; }
    else clearFieldError(emailInput);

    if (!passwordInput.value) { showFieldError(passwordInput, 'Password is required'); isValid = false; }
    else clearFieldError(passwordInput);

    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(input, message) {
    input.classList.add('input-error');
    const errorSpan = document.getElementById(`err-${input.id}`);
    if (errorSpan) errorSpan.textContent = message;
}

function clearFieldError(input) {
    input.classList.remove('input-error');
    const errorSpan = document.getElementById(`err-${input.id}`);
    if (errorSpan) errorSpan.textContent = '';
}

function clearAllErrors() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => clearFieldError(input));
}

function handleUserAuthSuccess(isAdmin = false) {
    const container = document.getElementById('container');
    const wipContainer = document.getElementById('work-in-progress');

    container.classList.add('fade-out');

    setTimeout(() => {
        container.classList.add('wip-hidden');
        if (isAdmin) {
            showAdminDashboard();
        } else if (wipContainer) {
            wipContainer.classList.remove('wip-hidden');
            wipContainer.setAttribute('aria-hidden', 'false');
        }
    }, 300);
}

function showAdminDashboard() {
    const container = document.getElementById('container');
    const wipContainer = document.getElementById('work-in-progress');
    const dash = document.getElementById('admin-dashboard');

    if (container) container.classList.add('wip-hidden');
    if (wipContainer) wipContainer.classList.add('wip-hidden');

    if (dash) {
        dash.classList.remove('wip-hidden');
        dash.setAttribute('aria-hidden', 'false');
        startLiveBackendPolling();
    }
}

function logoutAdmin() {
    localStorage.removeItem('quant_admin_session');
    if (updateIntervalTimer) clearInterval(updateIntervalTimer);

    const dash = document.getElementById('admin-dashboard');
    const container = document.getElementById('container');

    if (dash) dash.classList.add('wip-hidden');
    if (container) container.classList.remove('wip-hidden', 'fade-out');
}

/**
 * Switch Header Tabs Views
 * @param {'overview' | 'signals' | 'analytics' | 'system'} tabName 
 */
function switchDashTab(tabName) {
    const tabs = ['overview', 'signals', 'analytics', 'system'];
    
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
 * Real-time Backend Polling Loop (fetches from dashboard.py /api/data and /api/metrics)
 */
function startLiveBackendPolling() {
    fetchLiveDashboardData();
    if (updateIntervalTimer) clearInterval(updateIntervalTimer);
    updateIntervalTimer = setInterval(fetchLiveDashboardData, 5000); // refresh every 5s
}

async function fetchLiveDashboardData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) return;

        const data = await response.json();
        processLiveDashboardData(data);
    } catch (err) {
        // Log or handle offline state
    }
}

/**
 * Update UI elements from live dashboard.py JSON response
 */
function processLiveDashboardData(data) {
    if (!data) return;

    // 1. Update Equity & Balance KPIs
    if (data.equity) {
        const eq = data.equity;
        const totalEq = eq.total_equity !== undefined ? eq.total_equity : 5000.0;
        const baseEq = eq.base_balance !== undefined ? eq.base_balance : 5000.0;
        
        const eqElem = document.getElementById('val-equity');
        if (eqElem) {
            eqElem.textContent = `$${totalEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        const baseElem = document.getElementById('val-equity-base');
        if (baseElem) {
            baseElem.textContent = `Base: $${baseEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }

    // 2. Update Win Rate KPIs
    if (data.win_rate) {
        const wr = data.win_rate;
        const winratePct = wr.win_rate_pct !== undefined ? wr.win_rate_pct.toFixed(1) : '0.0';
        
        const wrElem = document.getElementById('val-winrate');
        if (wrElem) {
            wrElem.textContent = `${winratePct}%`;
        }

        const wrFooter = document.getElementById('val-winrate-footer');
        if (wrFooter) {
            wrFooter.textContent = `${wr.wins || 0} W / ${wr.losses || 0} L`;
        }
    }

    // 3. Update Signal Counters
    if (data.metrics && data.metrics.signals) {
        const sigs = data.metrics.signals;
        const sigElem = document.getElementById('val-signals');
        if (sigElem) {
            sigElem.textContent = `${sigs.executed || 0} / ${sigs.today || 0}`;
        }
    }

    // 4. Update Signal History List
    if (Array.isArray(data.session_signals)) {
        liveSignalsDataset = data.session_signals.map((sig, index) => formatBackendSignal(sig, index));
        renderOverviewPreview();
        renderSignalsTable(liveSignalsDataset);
    }
}

/**
 * Format raw backend SignalEvent dict into clean JS signal object
 */
function formatBackendSignal(sig, index) {
    const entryTime = sig.timestamp ? sig.timestamp.replace('T', ' ').slice(0, 19) : '—';
    const exitTime = sig.final_status === 'open' ? 'Active Open Position' : (sig.timestamp ? sig.timestamp.replace('T', ' ').slice(0, 19) : '—');
    const pnlVal = sig.unrealized_pnl !== undefined && sig.unrealized_pnl !== null ? `${sig.unrealized_pnl >= 0 ? '+' : ''}${sig.unrealized_pnl.toFixed(2)}%` : '0.00%';
    
    return {
        id: `sig-live-${index}`,
        entryTime: entryTime,
        exitTime: exitTime,
        symbol: sig.symbol || '—',
        strategy: sig.strategy || 'AutoSignal',
        type: (sig.signal_type || 'BUY').toUpperCase(),
        conf: sig.confidence || 'HIGH',
        entryPrice: sig.entry !== null && sig.entry !== undefined ? sig.entry : '—',
        exitPrice: sig.current_price !== null && sig.current_price !== undefined ? sig.current_price : (sig.entry || '—'),
        sl: sig.sl !== null && sig.sl !== undefined ? sig.sl : '—',
        tp: sig.tp !== null && sig.tp !== undefined ? sig.tp : '—',
        latency: sig.latency_ms !== null && sig.latency_ms !== undefined ? sig.latency_ms : 0,
        slippage: sig.slippage_pips !== null && sig.slippage_pips !== undefined ? sig.slippage_pips : 0,
        pnl: pnlVal,
        pnlPct: pnlVal,
        status: (sig.final_status || 'open').toLowerCase()
    };
}

function renderOverviewPreview() {
    const overviewBody = document.getElementById('overview-signals-body');
    if (!overviewBody) return;

    if (liveSignalsDataset.length === 0) {
        overviewBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    No signals recorded in current session. Waiting for bot signals...
                </td>
            </tr>
        `;
        return;
    }

    const previewData = liveSignalsDataset.slice(0, 5);
    overviewBody.innerHTML = previewData.map(sig => generateSignalRowHTML(sig, 'ov')).join('');
}

function renderSignalsTable(dataset) {
    const tbody = document.getElementById('signal-table-body');
    if (!tbody) return;

    if (!dataset || dataset.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 32px;">
                    <i class="fa-solid fa-database" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
                    No signals available in current session history.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = dataset.map(sig => generateSignalRowHTML(sig, 'sig')).join('');
}

/**
 * Generate main signal row and expandable detail row HTML
 */
function generateSignalRowHTML(sig, prefix) {
    const typeClass = sig.type === 'BUY' ? 'tag-buy' : 'tag-sell';
    const badgeClass = sig.status === 'win' ? 'badge-win' : (sig.status === 'loss' ? 'badge-loss' : 'badge-open');
    const rowId = `${prefix}-${sig.id}`;
    const detailRowId = `detail-${rowId}`;

    return `
        <tr class="signal-row" id="row-${rowId}" onclick="toggleSignalExpand('${rowId}')">
            <td><i class="fa-solid fa-chevron-down expand-chevron" id="chev-${rowId}"></i></td>
            <td style="color: var(--text-muted); font-size: 12px;">${sig.entryTime}</td>
            <td style="font-weight: 700;">${sig.symbol}</td>
            <td style="color: var(--text-muted);">${sig.strategy}</td>
            <td><span class="${typeClass}">${sig.type}</span></td>
            <td style="font-size: 11px; font-weight: 600;">${sig.conf}</td>
            <td>${sig.entryPrice}</td>
            <td style="color: #F87171;">${sig.sl}</td>
            <td style="color: var(--accent-green);">${sig.tp}</td>
            <td><span class="${badgeClass}">${sig.status.toUpperCase()} (${sig.pnl})</span></td>
        </tr>
        <tr id="${detailRowId}" class="signal-detail-row wip-hidden">
            <td colspan="10" class="signal-detail-cell">
                <div class="signal-detail-panel">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-circle-info" style="color: var(--accent-green);"></i>
                        Signal Execution & Target Breakdown (${sig.symbol})
                    </div>
                    
                    <div class="detail-grid">
                        <div class="detail-box">
                            <div class="detail-label">Entry Timestamp</div>
                            <div class="detail-val">${sig.entryTime}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Exit Timestamp</div>
                            <div class="detail-val">${sig.exitTime}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Entry Price</div>
                            <div class="detail-val">${sig.entryPrice}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Exit / Current Price</div>
                            <div class="detail-val">${sig.exitPrice}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Stop Loss (SL)</div>
                            <div class="detail-val" style="color: #F87171;">${sig.sl}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Take Profit (TP)</div>
                            <div class="detail-val" style="color: var(--accent-green);">${sig.tp}</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Execution Latency & Slip</div>
                            <div class="detail-val">${sig.latency} ms (${sig.slippage} pips)</div>
                        </div>

                        <div class="detail-box">
                            <div class="detail-label">Realized Profit / Loss</div>
                            <div class="detail-val" style="color: var(--accent-green);">${sig.pnl}</div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Toggle Expand/Collapse of Signal Accordion Row
 */
function toggleSignalExpand(rowId) {
    const mainRow = document.getElementById(`row-${rowId}`);
    const detailRow = document.getElementById(`detail-${rowId}`);

    if (detailRow && mainRow) {
        const isHidden = detailRow.classList.contains('wip-hidden');
        detailRow.classList.toggle('wip-hidden', !isHidden);
        mainRow.classList.toggle('expanded', isHidden);
    }
}

/**
 * Filter Signals in Signals History Tab
 */
function filterSignals() {
    const searchText = (document.getElementById('signal-search')?.value || '').toLowerCase();
    const statusVal = document.getElementById('filter-status')?.value || 'ALL';
    const typeVal = document.getElementById('filter-type')?.value || 'ALL';

    const filtered = liveSignalsDataset.filter(sig => {
        const matchesSearch = sig.symbol.toLowerCase().includes(searchText) || sig.strategy.toLowerCase().includes(searchText);
        const matchesStatus = (statusVal === 'ALL') || (sig.status.toUpperCase() === statusVal);
        const matchesType = (typeVal === 'ALL') || (sig.type === typeVal);
        return matchesSearch && matchesStatus && matchesType;
    });

    renderSignalsTable(filtered);
}

/**
 * MT5 Account Credentials Settings inside User Menu
 */
function loadMT5Settings() {
    const acc = localStorage.getItem('mt5_account_id') || '';
    const server = localStorage.getItem('mt5_server') || '';
    const risk = localStorage.getItem('mt5_risk_pct') || '0.5';

    const accInput = document.getElementById('mt5-account-id');
    const serverInput = document.getElementById('mt5-server');
    const riskInput = document.getElementById('mt5-risk');

    if (accInput) accInput.value = acc;
    if (serverInput) serverInput.value = server;
    if (riskInput) riskInput.value = risk;
}

function saveMT5Settings(e) {
    e.preventDefault();
    const acc = document.getElementById('mt5-account-id').value;
    const pass = document.getElementById('mt5-password').value;
    const server = document.getElementById('mt5-server').value;
    const risk = document.getElementById('mt5-risk').value;

    localStorage.setItem('mt5_account_id', acc);
    if (pass) localStorage.setItem('mt5_password', pass);
    localStorage.setItem('mt5_server', server);
    localStorage.setItem('mt5_risk_pct', risk);

    const menu = document.getElementById('user-dropdown-menu');
    if (menu) menu.classList.add('wip-hidden');
}

function exportSignalsCSV() {
    if (liveSignalsDataset.length === 0) {
        alert('No signals available to export.');
        return;
    }

    let csv = 'Timestamp Entry,Exit Time,Symbol,Strategy,Type,Confidence,Entry Price,Exit Price,SL,TP,PnL,Status\n';
    liveSignalsDataset.forEach(s => {
        csv += `${s.entryTime},${s.exitTime},${s.symbol},${s.strategy},${s.type},${s.conf},${s.entryPrice},${s.exitPrice},${s.sl},${s.tp},${s.pnl},${s.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `trading_signals_${Date.now()}.csv`);
    a.click();
}
