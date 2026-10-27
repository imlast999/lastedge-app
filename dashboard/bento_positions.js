/**
 * LastEdge — Finance Bento Positions Module
 * Pure DOM implementation adapted from finance-bento.tsx (21st.dev institutional grade fintech)
 * Powers:
 *   1. Bento Card 1: Operaciones Abiertas (Open Positions with visual Trailing Stop & 1-Click Close)
 *   2. Bento Card 2: Señales Pendientes de Confirmación (Approval Feed with 1-Click Approve & Execute)
 *   3. Bento Card 3: Historial Completo de Operaciones (Trade Journal with top KPI chips & paginated closed trades)
 *
 * Strict Zero-Placeholder Policy: Consumes live endpoints /api/positions, /api/signals, /api/trades.
 */

(function (window) {
    'use strict';

    // Theme and asset color palette
    const ASSET_COLORS = {
        EURUSD: { bg: 'rgba(255, 255, 255, 0.08)', text: '#FFFFFF', border: 'rgba(255, 255, 255, 0.25)', dot: '#FFFFFF' },
        XAUUSD: { bg: 'rgba(169, 178, 255, 0.12)', text: '#A9B2FF', border: 'rgba(169, 178, 255, 0.35)', dot: '#FFD700' },
        BTCEUR: { bg: 'rgba(255, 179, 122, 0.12)', text: '#FFB37A', border: 'rgba(255, 179, 122, 0.35)', dot: '#FFB37A' },
        BTCUSDT: { bg: 'rgba(255, 179, 122, 0.12)', text: '#FFB37A', border: 'rgba(255, 179, 122, 0.35)', dot: '#FFB37A' },
        DEFAULT: { bg: 'rgba(255, 255, 255, 0.06)', text: '#E2E8F0', border: 'rgba(255, 255, 255, 0.15)', dot: '#94A3B8' }
    };

    class BentoPositionsManager {
        constructor() {
            this.container = null;
            this.positions = [];
            this.signals = [];
            this.trades = [];
            this.isEngineOnline = false;
            this.isMT5Connected = false;
            this.currentPage = 1;
            this.pageSize = 8;
            this.loadingApproveId = null;
            this.closingTicket = null;
        }

        init(container) {
            this.container = container;
            this.renderStructure();
            this.fetchInitialData();

            // Dynamic ticker to update relative times, countdown chips, and auto-expire signals
            if (this._ticker) clearInterval(this._ticker);
            this._ticker = setInterval(() => {
                this.renderPendingSignals();
            }, 10000);
        }

        renderStructure() {
            if (!this.container) return;
            this.container.innerHTML = `
                <div class="fpb fpb-positions in">
                    <div class="fpb-c">
                        <!-- Header with live telemetry pulse -->
                        <div class="top" style="margin-bottom: 22px;">
                            <div class="top-left">
                                <h1 style="display: flex; align-items: center; gap: 10px;">
                                    <span class="pulse-indicator" id="pos-pulse-dot"></span>
                                    <span>Positions &amp; Trade Flow</span>
                                    <span id="pos-header-asof" style="font-weight: 500; color: rgba(255,255,255,0.4); font-size: 13px; margin-left: 8px;">
                                        Sincronizado con MT5
                                    </span>
                                </h1>
                            </div>
                            <div class="ctrls">
                                <div class="seg" id="pos-status-seg">
                                    <span id="pos-mt5-pill" class="status-pill pill-green" style="font-size: 11.5px; padding: 4px 10px;">
                                        MT5 CONECTADO
                                    </span>
                                </div>
                                <button class="btn-action" onclick="LastEdgeBentoPositions.instance.manualSync()" style="height: 32px; padding: 0 12px; font-size: 12px; border-radius: 12px;">
                                    <i class="fa-solid fa-arrows-rotate" id="pos-sync-icon"></i> Sincronizar
                                </button>
                            </div>
                        </div>

                        <!-- 12-Column Responsive Grid -->
                        <div class="pos-grid">
                            <!-- BENTO CARD 1: OPERACIONES ABIERTAS (Span 7) -->
                            <div class="card glass pos-card-open" id="bento-card-open-pos">
                                <div class="rim"></div>
                                <div class="pos-card-header">
                                    <div class="ttl">
                                        <i class="fa-solid fa-layer-group" style="color: var(--acc); font-size: 15px;"></i>
                                        <span>Open Positions</span>
                                        <span class="chip" id="chip-open-count" style="margin-left: 6px;">0</span>
                                    </div>
                                    <div id="open-total-pnl-chip" class="chip" style="background: rgba(255,255,255,0.06); font-family: 'Geist Mono', monospace;">
                                        Float: $0.00
                                    </div>
                                </div>
                                <div class="pos-card-body" id="bento-open-positions-list">
                                    <div class="pos-empty-state">
                                        <div class="pos-empty-icon"><i class="fa-solid fa-shield-check"></i></div>
                                        <div class="pos-empty-title">0 active positions &middot; 100% free margin</div>
                                        <div class="pos-empty-desc">Risk Engine v2 active guard &middot; No floating exposure</div>
                                    </div>
                                </div>
                            </div>

                            <!-- BENTO CARD 2: SEÑALES PENDIENTES DE CONFIRMACIÓN (Span 5) -->
                            <div class="card glass pos-card-pending" id="bento-card-pending-signals">
                                <div class="rim"></div>
                                <div class="pos-card-header">
                                    <div class="ttl">
                                        <i class="fa-solid fa-clock-rotate-left" style="color: #FFA500; font-size: 15px;"></i>
                                        <span>Pending Signals</span>
                                        <span class="chip" id="chip-pending-count" style="margin-left: 6px; background: rgba(255, 165, 0, 0.15); color: #FFA500; border: 1px solid rgba(255, 165, 0, 0.35);">
                                            0
                                        </span>
                                    </div>
                                    <span class="cap" style="color: #FFA500; font-size: 10.5px; letter-spacing: 0.05em;">1-CLICK APPROVAL</span>
                                </div>
                                <div class="pos-card-body" id="bento-pending-signals-list">
                                    <div class="pos-empty-state">
                                        <div class="pos-empty-icon" style="color: rgba(255, 255, 255, 0.25);"><i class="fa-solid fa-bell-slash"></i></div>
                                        <div class="pos-empty-title">No pending signals</div>
                                        <div class="pos-empty-desc">Signals requiring manual validation will appear here for 1-click execution.</div>
                                    </div>
                                </div>
                            </div>

                            <!-- BENTO CARD 3: HISTORIAL COMPLETO DE OPERACIONES (Span 12) -->
                            <div class="card glass pos-card-journal" id="bento-card-journal">
                                <div class="rim"></div>
                                <div class="pos-card-header" style="flex-wrap: wrap; gap: 14px;">
                                    <div class="ttl">
                                        <i class="fa-solid fa-book-bookmark" style="color: #A9B2FF; font-size: 15px;"></i>
                                        <span>Quantitative Trade Journal</span>
                                    </div>
                                    <!-- Top KPI Chips Row -->
                                    <div class="journal-kpi-row" id="journal-kpi-chips">
                                        <div class="journal-kpi-chip">
                                            <span class="kpi-label">Win Rate</span>
                                            <span class="kpi-val" id="kpi-winrate" style="color: #10B981;">0.0%</span>
                                        </div>
                                        <div class="journal-kpi-chip">
                                            <span class="kpi-label">Closed PnL</span>
                                            <span class="kpi-val" id="kpi-total-pnl">$0.00</span>
                                        </div>
                                        <div class="journal-kpi-chip">
                                            <span class="kpi-label">Trades</span>
                                            <span class="kpi-val" id="kpi-total-trades">0</span>
                                        </div>
                                        <div class="journal-kpi-chip">
                                            <span class="kpi-label">Avg Pips</span>
                                            <span class="kpi-val" id="kpi-avg-pips">0.0</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="journal-table-wrap">
                                    <table class="bento-trading-table">
                                        <thead>
                                            <tr>
                                                <th>Closed At</th>
                                                <th>Pair &amp; Direction</th>
                                                <th>Lots</th>
                                                <th>Entry &rarr; Exit</th>
                                                <th>Pips</th>
                                                <th>Exit Reason</th>
                                                <th style="text-align: right;">Net Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody id="bento-journal-tbody">
                                            <tr>
                                                <td colspan="7" style="text-align: center; color: rgba(255,255,255,0.4); padding: 36px;">
                                                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading trade journal...
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Pagination Controls -->
                                <div class="journal-pagination" id="journal-pagination-ctrls">
                                    <span id="journal-page-info" style="font-size: 12px; color: rgba(255,255,255,0.5); font-family: 'Geist Mono', monospace;">
                                        Page 1 of 1
                                    </span>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-action" id="btn-prev-page" onclick="LastEdgeBentoPositions.instance.prevPage()" style="height: 28px; padding: 0 10px; font-size: 11px;">
                                            <i class="fa-solid fa-chevron-left"></i> Previous
                                        </button>
                                        <button class="btn-action" id="btn-next-page" onclick="LastEdgeBentoPositions.instance.nextPage()" style="height: 28px; padding: 0 10px; font-size: 11px;">
                                            Next <i class="fa-solid fa-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        async fetchInitialData() {
            try {
                const [posRes, sigRes, tradeRes] = await Promise.all([
                    fetch('/api/positions').then(r => r.ok ? r.json() : { positions: [] }).catch(() => ({ positions: [] })),
                    fetch('/api/signals').then(r => r.ok ? r.json() : { signals: [] }).catch(() => ({ signals: [] })),
                    fetch('/api/trades').then(r => r.ok ? r.json() : []).catch(() => [])
                ]);

                this.positions = Array.isArray(posRes.positions) ? posRes.positions : (Array.isArray(posRes) ? posRes : []);
                this.signals = Array.isArray(sigRes.signals) ? sigRes.signals : (Array.isArray(sigRes) ? sigRes : []);
                this.trades = Array.isArray(tradeRes) ? tradeRes : [];

                this.renderAll();
            } catch (err) {
                console.warn('[BentoPositions] Initial fetch error:', err);
            }
        }

        update(telemetry) {
            if (!telemetry) return;
            this.isEngineOnline = telemetry.trading_engine_online === true;
            const tEngine = telemetry.trading_engine || {};
            const metrics = telemetry.metrics || {};
            this.isMT5Connected = this.isEngineOnline && Boolean(
                metrics.mt5_connected === true ||
                tEngine.mt5_connected === true ||
                (tEngine.health && tEngine.health.mt5_connected === true) ||
                (tEngine.health && tEngine.health.mt5 && tEngine.health.mt5.connected === true)
            );

            if (Array.isArray(telemetry.positions)) {
                this.positions = telemetry.positions;
            }
            if (Array.isArray(telemetry.signals)) {
                this.signals = telemetry.signals;
            }

            this.updateHeaderPill();
            this.renderOpenPositions();
            this.renderPendingSignals();
        }

        updateHeaderPill() {
            const pill = document.getElementById('pos-mt5-pill');
            const dot = document.getElementById('pos-pulse-dot');
            if (pill) {
                if (!this.isEngineOnline) {
                    pill.textContent = 'ENGINE OFFLINE (:8081)';
                    pill.className = 'status-pill pill-red';
                } else if (this.isMT5Connected) {
                    pill.textContent = 'MT5 CONECTADO';
                    pill.className = 'status-pill pill-green';
                } else {
                    pill.textContent = 'MT5 DESCONECTADO';
                    pill.className = 'status-pill pill-red';
                }
            }
            if (dot) {
                dot.style.background = this.isMT5Connected ? '#10B981' : '#EF4444';
                dot.style.boxShadow = this.isMT5Connected ? '0 0 10px #10B981' : '0 0 10px #EF4444';
            }
        }

        renderAll() {
            this.updateHeaderPill();
            this.renderOpenPositions();
            this.renderPendingSignals();
            this.renderTradeJournal();
        }

        /**
         * ── BENTO CARD 1: OPERACIONES ABIERTAS ──────────────────────────────
         */
        renderOpenPositions() {
            const container = document.getElementById('bento-open-positions-list');
            const countChip = document.getElementById('chip-open-count');
            const totalPnlChip = document.getElementById('open-total-pnl-chip');
            if (!container) return;

            const count = this.positions.length;
            if (countChip) countChip.textContent = count;

            let totalFloat = 0;
            this.positions.forEach(p => { totalFloat += Number(p.profit || 0); });
            if (totalPnlChip) {
                const sign = totalFloat >= 0 ? '+' : '';
                const color = totalFloat >= 0 ? '#10B981' : '#EF4444';
                totalPnlChip.innerHTML = `Float: <span style="color: ${color}; font-weight: 700;">${sign}$${totalFloat.toFixed(2)}</span>`;
            }

            if (count === 0) {
                container.innerHTML = `
                    <div class="pos-empty-state">
                        <div class="pos-empty-icon"><i class="fa-solid fa-shield-check"></i></div>
                        <div class="pos-empty-title">0 active positions &middot; 100% free margin</div>
                        <div class="pos-empty-desc">Risk Engine v2 active guard &middot; No floating exposure</div>
                    </div>
                `;
                return;
            }

            let html = '<div class="pos-items-grid">';
            this.positions.forEach(pos => {
                const ticket = pos.ticket;
                const sym = (pos.symbol || 'EURUSD').toUpperCase();
                const type = (pos.type || 'BUY').toUpperCase();
                const isBuy = type === 'BUY';
                const lot = Number(pos.volume || pos.lot || 0.01).toFixed(2);
                const openP = Number(pos.open_price || pos.openPrice || 0);
                const curP = Number(pos.current_price || pos.marketPrice || pos.open_price || 0);
                const sl = Number(pos.sl || 0);
                const tp = Number(pos.tp || 0);
                const pnl = Number(pos.profit || 0);
                const pnlSign = pnl >= 0 ? '+' : '';
                const pnlColor = pnl >= 0 ? '#10B981' : '#EF4444';

                // Asset design tokens
                const assetStyle = ASSET_COLORS[sym] || ASSET_COLORS.DEFAULT;

                // Visual Trailing Stop Calculation
                let trailingPct = 0;
                let trailingText = 'Breakeven Pending';
                let beSecured = false;

                if (openP > 0 && curP > 0) {
                    const priceDiff = isBuy ? (curP - openP) : (openP - curP);
                    const pipScale = sym.includes('XAU') ? 0.1 : (sym.includes('BTC') ? 1.0 : 0.0001);
                    const pipsGained = priceDiff / pipScale;

                    if (tp > 0 && tp !== openP) {
                        const targetDiff = Math.abs(tp - openP);
                        trailingPct = Math.min(100, Math.max(0, (priceDiff / targetDiff) * 100));
                    } else {
                        trailingPct = Math.min(100, Math.max(0, pipsGained * 5));
                    }

                    if (sl > 0) {
                        if (isBuy && sl >= openP) {
                            beSecured = true;
                            trailingText = `BE Protegido &middot; SL @ ${sl.toFixed(sym.includes('BTC') ? 2 : 5)}`;
                        } else if (!isBuy && sl <= openP) {
                            beSecured = true;
                            trailingText = `BE Protegido &middot; SL @ ${sl.toFixed(sym.includes('BTC') ? 2 : 5)}`;
                        } else {
                            trailingText = `Recorrido: ${pipsGained.toFixed(1)} pips hacia BE`;
                        }
                    } else {
                        trailingText = `Recorrido: ${pipsGained.toFixed(1)} pips`;
                    }
                }

                const isClosing = this.closingTicket === ticket;

                html += `
                    <div class="pos-item-card">
                        <div class="pos-item-top">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="pos-symbol-chip" style="background: ${assetStyle.bg}; color: ${assetStyle.text}; border-color: ${assetStyle.border};">
                                    <span class="pos-dot" style="background: ${assetStyle.dot};"></span>
                                    ${sym}
                                </span>
                                <span class="pos-type-tag ${isBuy ? 'tag-buy' : 'tag-sell'}">${type}</span>
                                <span class="chip" style="font-size: 11px;">${lot} L</span>
                                <span style="font-family: 'Geist Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.4);">#${ticket}</span>
                            </div>
                            <div class="pos-pnl-val" style="color: ${pnlColor};">
                                ${pnlSign}$${pnl.toFixed(2)}
                            </div>
                        </div>

                        <!-- Price Details Grid -->
                        <div class="pos-price-row">
                            <div class="price-cell">
                                <span class="cell-label">Entrada</span>
                                <span class="cell-val">${openP.toFixed(sym.includes('BTC') ? 2 : 5)}</span>
                            </div>
                            <div class="price-cell">
                                <span class="cell-label">Mercado</span>
                                <span class="cell-val" style="color: #FFFFFF;">${curP.toFixed(sym.includes('BTC') ? 2 : 5)}</span>
                            </div>
                            <div class="price-cell">
                                <span class="cell-label">Stop Loss</span>
                                <span class="cell-val" style="color: #EF4444;">${sl > 0 ? sl.toFixed(sym.includes('BTC') ? 2 : 5) : '—'}</span>
                            </div>
                            <div class="price-cell">
                                <span class="cell-label">Take Profit</span>
                                <span class="cell-val" style="color: #10B981;">${tp > 0 ? tp.toFixed(sym.includes('BTC') ? 2 : 5) : '—'}</span>
                            </div>
                        </div>

                        <!-- Trailing Stop Visual Progress Bar -->
                        <div class="trailing-container">
                            <div class="trailing-header">
                                <span class="trailing-title">
                                    <i class="fa-solid fa-route" style="color: ${beSecured ? '#10B981' : 'var(--acc)'}; margin-right: 5px;"></i>
                                    ${trailingText}
                                </span>
                                <span class="trailing-pct">${trailingPct.toFixed(0)}% a TP</span>
                            </div>
                            <div class="trailing-track">
                                <div class="trailing-fill ${beSecured ? 'fill-be-secured' : ''}" style="width: ${trailingPct}%;"></div>
                                <div class="trailing-be-marker" title="Breakeven Threshold"></div>
                            </div>
                        </div>

                        <!-- Action Row -->
                        <div class="pos-item-actions" style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button class="btn-chart-pos" onclick="LastEdgeBentoPositions.instance.viewPositionChart(${ticket}, '${symbol}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
                                <i class="fa-solid fa-chart-line" style="color: #00ff88;"></i> Chart
                            </button>
                            <button class="btn-close-pos" onclick="LastEdgeBentoPositions.instance.closePosition(${ticket}, this)" ${isClosing ? 'disabled' : ''}>
                                ${isClosing ? '<i class="fa-solid fa-spinner fa-spin"></i> Closing...' : '<i class="fa-solid fa-xmark"></i> Close Position'}
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        /**
         * ── BENTO CARD 2: SEÑALES PENDIENTES DE CONFIRMACIÓN ────────────────
         */
        renderPendingSignals() {
            const container = document.getElementById('bento-pending-signals-list');
            const countChip = document.getElementById('chip-pending-count');
            if (!container) return;

            const now = new Date();

            const getSignalDate = (s) => {
                const raw = s.created_at || s.timestamp || s.time || s.date;
                if (!raw) return now;
                if (typeof raw === 'number') {
                    return raw > 1e11 ? new Date(raw) : new Date(raw * 1000);
                }
                let str = String(raw).trim();
                if (/^\d+$/.test(str)) {
                    const num = Number(str);
                    return num > 1e11 ? new Date(num) : new Date(num * 1000);
                }
                str = str.replace(' ', 'T');
                if (!str.includes('Z') && !str.includes('+') && !str.slice(10).includes('-')) {
                    str += 'Z';
                }
                const d = new Date(str);
                return isNaN(d.getTime()) ? now : d;
            };

            // Filtrar señales: excluir >10 min, EXPIRED o REJECTED_MANUAL
            const pendingSignals = this.signals.filter(s => {
                const st = (s.status || '').toUpperCase();
                if (st === 'EXPIRED' || st === 'REJECTED_MANUAL' || st === 'REJECTED' || st === 'EXECUTED' || st === 'CLOSED') {
                    return false;
                }
                if (st !== 'PROPOSED' && st !== 'PENDING' && st !== 'MANUAL' && st !== '') {
                    return false;
                }
                const sigDate = getSignalDate(s);
                const ageSeconds = (now.getTime() - sigDate.getTime()) / 1000;
                // Auto-expiración tras 10 minutos (600s)
                if (ageSeconds > 600) {
                    return false;
                }
                return true;
            });

            const count = pendingSignals.length;
            if (countChip) countChip.textContent = count;

            if (count === 0) {
                container.innerHTML = `
                    <div class="pos-empty-state">
                        <div class="pos-empty-icon" style="color: rgba(255, 255, 255, 0.25);"><i class="fa-solid fa-bell-slash"></i></div>
                        <div class="pos-empty-title">No pending signals</div>
                        <div class="pos-empty-desc">Signals requiring manual validation will appear here for instant 1-click execution.</div>
                    </div>
                `;
                return;
            }

            let html = '<div class="pending-signals-feed">';
            pendingSignals.forEach(sig => {
                const sigId = sig.id;
                const sym = (sig.symbol || 'EURUSD').toUpperCase();
                const type = (sig.type || sig.direction || 'BUY').toUpperCase();
                const isBuy = type === 'BUY';
                const entry = Number(sig.entry || sig.price || 0);
                const sl = Number(sig.stopLoss || sig.sl || 0);
                const tp = Number(sig.takeProfit || sig.tp || 0);
                const rr = sig.rrRatio || sig.rr || 1.5;
                const lot = Number(sig.lot || 0.01).toFixed(2);
                const conf = (sig.confidence || 'MEDIUM').toUpperCase();
                const strategy = sig.strategy || 'AutoSignals';
                const assetStyle = ASSET_COLORS[sym] || ASSET_COLORS.DEFAULT;

                // Cálculo de tiempos relativos y cuenta atrás (TTL 10 min)
                const sigDate = getSignalDate(sig);
                const exactTime = sigDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const ageSeconds = Math.max(0, Math.floor((now.getTime() - sigDate.getTime()) / 1000));
                const ageMinutes = Math.floor(ageSeconds / 60);
                const relativeBadge = ageMinutes < 1 ? `hace ${ageSeconds}s` : `hace ${ageMinutes} min`;

                const remainingSeconds = Math.max(0, 600 - ageSeconds);
                const remainingMinutes = Math.ceil(remainingSeconds / 60);
                const isUrgent = remainingSeconds < 180;
                const countdownText = `⏳ Expira en ${remainingMinutes} min`;
                const countdownClass = isUrgent ? 'countdown-chip countdown-urgent' : 'countdown-chip';

                const isApproving = this.loadingApproveId === String(sigId);

                html += `
                    <div class="pending-sig-card" id="pending-card-${sigId}">
                        <div class="pending-sig-header">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="pos-symbol-chip" style="background: ${assetStyle.bg}; color: ${assetStyle.text}; border-color: ${assetStyle.border};">
                                    <span class="pos-dot" style="background: ${assetStyle.dot};"></span>
                                    ${sym}
                                </span>
                                <span class="pos-type-tag ${isBuy ? 'tag-buy' : 'tag-sell'}">${type}</span>
                                <span class="chip" style="font-size: 10.5px;">${lot} L</span>
                            </div>
                            <span class="conf-pill conf-${conf.toLowerCase().replace(/[^a-z]/g, '')}">${conf}</span>
                        </div>

                        <!-- Hora exacta de emisión, antigüedad relativa y chip de expiración dinámica -->
                        <div class="pending-time-row">
                            <div class="time-left">
                                <i class="fa-regular fa-clock"></i>
                                <span class="exact-time">${exactTime}</span>
                                <span class="rel-time">(${relativeBadge})</span>
                            </div>
                            <span class="${countdownClass}">${countdownText}</span>
                        </div>

                        <div class="pending-sig-strategy">
                            <i class="fa-solid fa-microchip" style="margin-right: 5px; color: rgba(255,255,255,0.4);"></i>
                            ${strategy} &middot; R:R 1:${Number(rr).toFixed(2)}
                        </div>

                        <div class="pending-prices-row">
                            <div><span class="lbl">Entrada:</span> <span class="val">${entry.toFixed(sym.includes('BTC') ? 2 : 5)}</span></div>
                            <div><span class="lbl">SL:</span> <span class="val" style="color: #EF4444;">${sl.toFixed(sym.includes('BTC') ? 2 : 5)}</span></div>
                            <div><span class="lbl">TP:</span> <span class="val" style="color: #10B981;">${tp.toFixed(sym.includes('BTC') ? 2 : 5)}</span></div>
                        </div>

                        <div class="pending-actions-row">
                            <button class="btn-reject-signal" onclick="LastEdgeBentoPositions.instance.rejectSignal('${sigId}', this)">
                                <i class="fa-solid fa-xmark"></i>
                                <span>Dismiss</span>
                            </button>
                            <button class="btn-chart-pos" onclick="LastEdgeBentoPositions.instance.viewSymbolChart('${sym}')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-chart-line" style="color: #00ff88;"></i>
                                <span>Chart</span>
                            </button>
                            <button class="btn-approve-1click" onclick="LastEdgeBentoPositions.instance.approveSignal('${sigId}', this)" ${isApproving ? 'disabled' : ''}>
                                ${isApproving ? '<i class="fa-solid fa-spinner fa-spin"></i> Executing on MT5...' : '<i class="fa-solid fa-bolt"></i> Approve & Execute'}
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        }

        /**
         * ── BENTO CARD 3: HISTORIAL COMPLETO DE OPERACIONES ─────────────────
         */
        renderTradeJournal() {
            const tbody = document.getElementById('bento-journal-tbody');
            if (!tbody) return;

            // Update Top KPI chips
            const totalTrades = this.trades.length;
            let wins = 0;
            let totalProfit = 0;
            let totalPips = 0;

            this.trades.forEach(t => {
                const profit = Number(t.profit || 0);
                const pips = Number(t.pips || 0);
                totalProfit += profit;
                totalPips += pips;
                if (profit > 0 || (t.closeReason || '').toUpperCase() === 'TAKE_PROFIT') {
                    wins++;
                }
            });

            const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
            const avgPips = totalTrades > 0 ? (totalPips / totalTrades).toFixed(1) : '0.0';

            const wrElem = document.getElementById('kpi-winrate');
            const pnlElem = document.getElementById('kpi-total-pnl');
            const ttElem = document.getElementById('kpi-total-trades');
            const pipsElem = document.getElementById('kpi-avg-pips');

            if (wrElem) wrElem.textContent = `${winRate}%`;
            if (pnlElem) {
                const sign = totalProfit >= 0 ? '+' : '';
                pnlElem.textContent = `${sign}$${totalProfit.toFixed(2)}`;
                pnlElem.style.color = totalProfit >= 0 ? '#10B981' : '#EF4444';
            }
            if (ttElem) ttElem.textContent = String(totalTrades);
            if (pipsElem) pipsElem.textContent = `${avgPips} pips`;

            if (totalTrades === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: rgba(255,255,255,0.4); padding: 36px;">
                            <i class="fa-solid fa-check-circle" style="color: #10B981; margin-right: 6px;"></i>
                            Institutional journal ready &middot; No closed trades recorded in this period.
                        </td>
                    </tr>
                `;
                return;
            }

            // Pagination calculation
            const totalPages = Math.ceil(totalTrades / this.pageSize) || 1;
            if (this.currentPage > totalPages) this.currentPage = totalPages;
            if (this.currentPage < 1) this.currentPage = 1;

            const startIdx = (this.currentPage - 1) * this.pageSize;
            const endIdx = startIdx + this.pageSize;
            const paginated = this.trades.slice(startIdx, endIdx);

            const pageInfo = document.getElementById('journal-page-info');
            if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages} (${totalTrades} trades)`;

            const btnPrev = document.getElementById('btn-prev-page');
            const btnNext = document.getElementById('btn-next-page');
            if (btnPrev) btnPrev.disabled = this.currentPage <= 1;
            if (btnNext) btnNext.disabled = this.currentPage >= totalPages;

            let rowsHtml = '';
            paginated.forEach(t => {
                const sym = (t.symbol || 'EURUSD').toUpperCase();
                const type = (t.type || 'BUY').toUpperCase();
                const isBuy = type === 'BUY';
                const lot = Number(t.lot || 0.01).toFixed(2);
                const openP = Number(t.openPrice || 0);
                const closeP = Number(t.closePrice || 0);
                const pips = Number(t.pips || 0);
                const profit = Number(t.profit || 0);
                const pnlSign = profit >= 0 ? '+' : '';
                const pnlColor = profit >= 0 ? '#10B981' : '#EF4444';

                // Reason pill
                const reason = (t.closeReason || 'MANUAL').toUpperCase();
                let reasonPill = '<span class="reason-pill reason-manual">MANUAL</span>';
                if (reason.includes('TAKE') || reason.includes('TP') || reason.includes('PROFIT')) {
                    reasonPill = '<span class="reason-pill reason-tp">TAKE PROFIT</span>';
                } else if (reason.includes('STOP') || reason.includes('SL') || reason.includes('LOSS')) {
                    reasonPill = '<span class="reason-pill reason-sl">STOP LOSS</span>';
                } else if (reason.includes('TRAIL') || reason.includes('BE')) {
                    reasonPill = '<span class="reason-pill reason-trail">TRAILING STOP</span>';
                }

                // Date formatting
                let dateStr = '—';
                try {
                    const d = new Date(t.closedAt || t.timestamp);
                    dateStr = d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) + ' ' +
                              d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                } catch (_) {}

                rowsHtml += `
                    <tr>
                        <td style="font-family: 'Geist Mono', monospace; font-size: 11.5px; color: rgba(255,255,255,0.6);">${dateStr}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-weight: 700; color: #FFFFFF;">${sym}</span>
                                <span class="pos-type-tag ${isBuy ? 'tag-buy' : 'tag-sell'}" style="font-size: 10px; padding: 2px 6px;">${type}</span>
                            </div>
                        </td>
                        <td style="font-family: 'Geist Mono', monospace; font-size: 12px;">${lot}</td>
                        <td style="font-family: 'Geist Mono', monospace; font-size: 12px; color: rgba(255,255,255,0.75);">
                            ${openP.toFixed(sym.includes('BTC') ? 2 : 5)} &rarr; ${closeP.toFixed(sym.includes('BTC') ? 2 : 5)}
                        </td>
                        <td style="font-family: 'Geist Mono', monospace; font-size: 12px; color: ${pips >= 0 ? '#10B981' : '#EF4444'};">
                            ${pips >= 0 ? '+' : ''}${pips.toFixed(1)}
                        </td>
                        <td>${reasonPill}</td>
                        <td style="text-align: right; font-family: 'Geist Mono', monospace; font-weight: 700; font-size: 13px; color: ${pnlColor};">
                            ${pnlSign}$${profit.toFixed(2)}
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = rowsHtml;
        }

        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTradeJournal();
            }
        }

        nextPage() {
            const totalPages = Math.ceil(this.trades.length / this.pageSize) || 1;
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderTradeJournal();
            }
        }

        /**
         * ── 1-CLICK APPROVE & EXECUTE SIGNAL ─────────────────────────────────
         */
        async approveSignal(signalId, btnElement, force = false) {
            if (this.loadingApproveId) return;
            this.loadingApproveId = String(signalId);
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Executing on MT5...';
            }

            try {
                const response = await fetch('/api/signals/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signal_id: Number(signalId), force: Boolean(force) })
                });

                const result = await response.json();

                // Sub-caso: Desviación de precio detectada (PRICE_DRIFT)
                if (result.error === 'PRICE_DRIFT' || (!result.ok && result.error === 'PRICE_DRIFT')) {
                    if (btnElement) {
                        btnElement.disabled = false;
                        btnElement.innerHTML = '<i class="fa-solid fa-bolt"></i> Approve & Execute';
                    }
                    this.showPriceDriftDialog(result, () => {
                        this.approveSignal(signalId, btnElement, true);
                    }, () => {
                        this.loadingApproveId = null;
                        this.renderPendingSignals();
                    });
                    return;
                }

                if (result.ok) {
                    // Feedback visual inmediato
                    if (btnElement) {
                        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Executed!';
                        btnElement.style.background = '#10B981';
                        btnElement.style.color = '#FFFFFF';
                    }

                    // Remover la señal de pendientes localmente
                    this.signals = this.signals.filter(s => String(s.id) !== String(signalId));

                    // Refrescar inmediatamente datos de MT5
                    await this.syncFreshPositions();
                } else {
                    alert('Error approving signal: ' + (result.error || result.message || 'Unknown MT5 execution failure'));
                    if (btnElement) {
                        btnElement.disabled = false;
                        btnElement.innerHTML = '<i class="fa-solid fa-bolt"></i> Retry Approval';
                    }
                }
            } catch (err) {
                console.error('[BentoPositions] Approve error:', err);
                alert('Connection error approving signal: ' + err);
                if (btnElement) {
                    btnElement.disabled = false;
                    btnElement.innerHTML = '<i class="fa-solid fa-bolt"></i> Retry Approval';
                }
            } finally {
                this.loadingApproveId = null;
                this.renderPendingSignals();
            }
        }

        async rejectSignal(sigId, btnElement) {
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dismissing...';
            }

            try {
                const response = await fetch('/api/signals/reject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ signal_id: Number(sigId) })
                });

                const result = await response.json();
                if (result.ok) {
                    const card = document.getElementById(`pending-card-${sigId}`);
                    if (card) {
                        card.style.transition = 'all 0.22s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            this.signals = this.signals.filter(s => String(s.id) !== String(sigId));
                            this.renderPendingSignals();
                        }, 220);
                    } else {
                        this.signals = this.signals.filter(s => String(s.id) !== String(sigId));
                        this.renderPendingSignals();
                    }
                } else {
                    alert('Error dismissing signal: ' + (result.error || 'Server error'));
                    if (btnElement) {
                        btnElement.disabled = false;
                        btnElement.innerHTML = '<i class="fa-solid fa-xmark"></i> Dismiss';
                    }
                }
            } catch (err) {
                console.error('[BentoPositions] Reject error:', err);
                alert('Connection error dismissing signal: ' + err);
                if (btnElement) {
                    btnElement.disabled = false;
                    btnElement.innerHTML = '<i class="fa-solid fa-xmark"></i> Dismiss';
                }
            }
        }

        showPriceDriftDialog(driftData, onConfirmForce, onCancel) {
            let modal = document.getElementById('bento-drift-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'bento-drift-modal';
                document.body.appendChild(modal);
            }

            const sym = driftData.symbol || 'ACTIVO';
            const sigPrice = driftData.signal_price || 0;
            const curPrice = driftData.current_price || 0;
            const driftPips = driftData.drift_pips || '';

            modal.innerHTML = `
                <div class="bento-modal-backdrop">
                    <div class="bento-modal-card">
                        <div class="bento-modal-header">
                            <div class="modal-icon-warning">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                                <h3 class="bento-modal-title">Price Drift Alert</h3>
                                <p class="bento-modal-subtitle">${sym} &middot; Active Slippage Guard</p>
                            </div>
                        </div>

                        <div class="bento-modal-body">
                            <p style="font-size: 13px; color: var(--t2); line-height: 1.5; margin-bottom: 14px;">
                                Market price has moved since signal generation:
                            </p>
                            <div class="drift-comparison-grid">
                                <div class="drift-comp-cell">
                                    <span class="drift-comp-lbl">Signal Price</span>
                                    <span class="drift-comp-val">${sigPrice}</span>
                                </div>
                                <div class="drift-comp-arrow">
                                    <i class="fa-solid fa-arrow-right"></i>
                                </div>
                                <div class="drift-comp-cell highlight-drift">
                                    <span class="drift-comp-lbl">Current MT5 Price</span>
                                    <span class="drift-comp-val">${curPrice}</span>
                                </div>
                            </div>
                            <div class="drift-summary-pill">
                                <i class="fa-solid fa-gauge-high"></i> Detected Drift: <strong>${driftPips}</strong>
                            </div>
                            <p style="font-size: 12px; color: var(--t3); margin-top: 12px; line-height: 1.4;">
                                Do you wish to execute at the current market price or cancel execution?
                            </p>
                        </div>

                        <div class="bento-modal-actions">
                            <button class="btn-modal-cancel" id="btn-drift-cancel">
                                <i class="fa-solid fa-xmark"></i> Cancel
                            </button>
                            <button class="btn-modal-force" id="btn-drift-confirm">
                                <i class="fa-solid fa-bolt"></i> Execute at Market
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modal.style.display = 'block';

            const cancelBtn = document.getElementById('btn-drift-cancel');
            const confirmBtn = document.getElementById('btn-drift-confirm');

            const closeModal = () => {
                modal.style.display = 'none';
                modal.innerHTML = '';
            };

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    closeModal();
                    if (typeof onCancel === 'function') onCancel();
                };
            }

            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    closeModal();
                    if (typeof onConfirmForce === 'function') onConfirmForce();
                };
            }
        }

        /**
         * ── CLOSE POSITION ACTION ───────────────────────────────────────────
         */
        async closePosition(ticket, btnElement) {
            if (!confirm(`Confirm immediate close of position #${ticket} on MetaTrader 5?`)) {
                return;
            }

            this.closingTicket = ticket;
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cerrando...';
            }

            try {
                const response = await fetch('/api/positions/close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticket: Number(ticket) })
                });

                const result = await response.json();
                if (result.ok) {
                    // Remover posición localmente
                    this.positions = this.positions.filter(p => Number(p.ticket) !== Number(ticket));
                    this.renderOpenPositions();

                    // Re-sincronizar posiciones y diario
                    await this.syncFreshPositions();
                } else {
                    alert('Error closing position: ' + (result.error || 'MT5 could not process request'));
                }
            } catch (err) {
                console.error('[BentoPositions] Close error:', err);
                alert('Connection error closing position: ' + err);
            } finally {
                this.closingTicket = null;
                this.renderOpenPositions();
            }
        }

        async syncFreshPositions() {
            try {
                const [posRes, sigRes, tradeRes] = await Promise.all([
                    fetch('/api/positions').then(r => r.ok ? r.json() : { positions: [] }).catch(() => ({ positions: [] })),
                    fetch('/api/signals').then(r => r.ok ? r.json() : { signals: [] }).catch(() => ({ signals: [] })),
                    fetch('/api/trades').then(r => r.ok ? r.json() : []).catch(() => [])
                ]);

                if (posRes && Array.isArray(posRes.positions)) {
                    this.positions = posRes.positions;
                }
                if (sigRes && Array.isArray(sigRes.signals)) {
                    this.signals = sigRes.signals;
                }
                if (Array.isArray(tradeRes)) {
                    this.trades = tradeRes;
                }

                this.renderAll();
            } catch (e) {
                console.warn('[BentoPositions] syncFreshPositions error:', e);
            }
        }

        viewPositionChart(ticket, symbol) {
            this._openChartModal(`/api/positions/${ticket}/chart`, `${symbol} — Position #${ticket}`);
        }

        viewSymbolChart(symbol) {
            this._openChartModal(`/api/chart/${symbol}`, `${symbol} — Live Technical Chart`);
        }

        _openChartModal(imgUrl, title) {
            const modalId = 'bento-chart-modal-overlay';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
                modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background:#1e1e1e;border:1px solid rgba(255,255,255,0.18);border-radius:14px;max-width:920px;width:100%;padding:20px;box-shadow:0 24px 48px rgba(0,0,0,0.7);position:relative;animation:fadeIn 0.2s ease;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
                        <h3 style="margin:0;font-size:16px;color:#fff;display:flex;align-items:center;gap:10px;">
                            <i class="fa-solid fa-chart-candlestick" style="color:#00ff88;"></i>
                            <span>${title}</span>
                        </h3>
                        <button onclick="document.getElementById('${modalId}').style.display='none'" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:16px;width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;min-height:360px;background:#151515;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
                        <img src="${imgUrl}?t=${Date.now()}" alt="${title}" style="max-width:100%;height:auto;display:block;" onerror="this.parentElement.innerHTML='<div style=\'text-align:center;padding:40px;color:#f87171;\'><i class=\'fa-solid fa-triangle-exclamation\' style=\'font-size:28px;margin-bottom:8px;\'></i><p style=\'margin:0;\'>Chart currently unavailable from MT5.</p></div>'" />
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12px;color:#94a3b8;">
                        <span><b style="color:#00ff88;">🟩 Entry</b> | <b style="color:#ef4444;">🟥 Stop Loss</b> | <b style="color:#38bdf8;">🟦 Take Profit</b> | <b style="color:#22d3ee;">Cyan EMA50</b> | <b style="color:#e879f9;">Magenta EMA200</b></span>
                        <button onclick="document.getElementById('${modalId}').style.display='none'" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:500;">Close</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }

        manualSync() {
            const icon = document.getElementById('pos-sync-icon');
            if (icon) icon.classList.add('fa-spin');
            this.syncFreshPositions().finally(() => {
                setTimeout(() => {
                    if (icon) icon.classList.remove('fa-spin');
                }, 600);
            });
        }
    }

    // Expose global singleton
    const manager = new BentoPositionsManager();
    window.LastEdgeBentoPositions = {
        instance: manager,
        init: function (mountElem) {
            manager.init(mountElem);
        },
        update: function (telemetry) {
            manager.update(telemetry);
        }
    };

})(window);
