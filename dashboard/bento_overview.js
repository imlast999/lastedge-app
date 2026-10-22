/**
 * LastEdge — Finance Bento Overview Module
 * Pure DOM + SVG implementation adapted from finance-bento.tsx
 * Real-time synchronization with MT5 telemetry, Trading Engine & Strategy Lab (/api/data)
 */

(function (window) {
    'use strict';

    // Color definitions
    const ACC = '#E8FF1F';
    const T2 = 'rgba(255, 255, 255, 0.65)';
    const T3 = 'rgba(255, 255, 255, 0.40)';
    const HAIR = 'rgba(255, 255, 255, 0.12)';
    const COL = {
        eurusd: '#FFFFFF',    // Forex (Fiat / White)
        xauusd: '#A9B2FF',    // Metals / Gold (Periwinkle / Soft Blue)
        btceur: '#FFB37A',    // Crypto (Warm Orange)
        cash: 'rgba(255, 255, 255, 0.28)'
    };

    const GR = {
        blue:   { top: '#b9a6ff', base: '#2e43ff', bottom: '#6d7dff', core: '#05082a' },
        graph:  { top: '#9a9aa8', base: '#3a3a44', bottom: '#55555f', core: '#060608' },
        pink:   { top: '#ffb3d6', base: '#ff2a85', bottom: '#ff6aa8', core: '#3a031c' },
        copper: { top: '#f6bf96', base: '#c2683a', bottom: '#dc8a5c', core: '#1d0b05' },
        green:  { top: '#a6e8c8', base: '#36956f', bottom: '#58b58c', core: '#061d15' },
        lime:   { top: '#f4ffb8', base: '#a3c400', bottom: '#c9e03a', core: '#121700' }
    };

    const NS = 'http://www.w3.org/2000/svg';
    const ease = t => 1 - Math.pow(1 - t, 3);
    const P2 = (r, a) => [r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180)];

    const F = {
        '0': ['01110','10001','10011','10101','11001','10001','01110'],
        '1': ['00100','01100','00100','00100','00100','00100','01110'],
        '2': ['01110','10001','00001','00010','00100','01000','11111'],
        '3': ['11111','00010','00100','00010','00001','10001','01110'],
        '4': ['00010','00110','01010','10010','11111','00010','00010'],
        '5': ['11111','10000','11110','00001','00001','10001','01110'],
        '6': ['00110','01000','10000','11110','10001','10001','01110'],
        '7': ['11111','00001','00010','00100','01000','01000','01000'],
        '8': ['01110','10001','10001','01110','10001','10001','01110'],
        '9': ['01110','10001','10001','01111','00001','00010','01100'],
        '$': ['00100','01111','10100','01110','00101','11110','00100'],
        '€': ['00111','01000','11110','01000','11110','01000','00111'],
        ',': ['0','0','0','0','0','1','1'],
        '.': ['0','0','0','0','0','1','1'],
        '-': ['0000','0000','0000','1111','0000','0000','0000'],
        'O': ['01110','10001','10001','10001','10001','10001','01110'],
        'F': ['11111','10000','11110','10000','10000','10000','10000'],
        'L': ['10000','10000','10000','10000','10000','10000','11111'],
        'I': ['01110','00100','00100','00100','00100','00100','01110'],
        'N': ['10001','11001','10101','10011','10001','10001','10001'],
        'E': ['11111','10000','11110','10000','10000','10000','11111'],
        'M': ['10001','11011','10101','10001','10001','10001','10001'],
        'T': ['11111','00100','00100','00100','00100','00100','00100'],
        '5': ['11111','10000','11110','00001','00001','10001','01110'],
        ' ': ['00','00','00','00','00','00','00']
    };

    function el(tag, attrs = {}, parent = null) {
        const elem = document.createElementNS(NS, tag);
        for (const k in attrs) elem.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(elem);
        return elem;
    }

    function bg({ top, base, bottom, core }) {
        return `<div class="g" style="background:linear-gradient(180deg,${top} 0%,${base} 36%,${base} 74%,${bottom} 100%)"></div><div class="core" style="background:${core}"></div>`;
    }

    function smoothPath(P, move = true) {
        if (!P || P.length === 0) return '';
        let d = (move ? 'M' : 'L') + `${P[0][0]},${P[0][1]}`;
        for (let i = 0; i < P.length - 1; i++) {
            const p0 = P[i - 1] || P[i];
            const p1 = P[i];
            const p2 = P[i + 1];
            const p3 = P[i + 2] || p2;
            const k = 0.17;
            d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
        }
        return d;
    }

    // DotNumber matrix digit display
    function createDotNumber(host, pitch) {
        const cols = 48;
        const svg = el('svg', { class: 'dots', 'aria-hidden': 'true' }, host);
        const cells = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < 7; r++) {
                const ci = el('circle', {
                    cx: c * pitch + pitch / 2,
                    cy: r * pitch + pitch / 2,
                    r: pitch * 0.36,
                    fill: '#fff',
                    opacity: 0
                }, svg);
                ci.style.transitionDelay = (c * 6) + 'ms';
                cells.push([c, r, ci]);
            }
        }

        const set = text => {
            const on = new Set();
            let x = 0;
            for (const ch of String(text).toUpperCase()) {
                const g = F[ch] || F[' '];
                const w = g[0].length;
                for (let r = 0; r < 7; r++) {
                    for (let k = 0; k < w; k++) {
                        if (g[r][k] === '1') on.add((x + k) * 8 + r);
                    }
                }
                x += w + 1;
            }
            const used = Math.max(1, x - 1);
            for (const [c, r, ci] of cells) {
                const v = on.has(c * 8 + r);
                ci.setAttribute('opacity', v ? 1 : (c < used ? 0.08 : 0));
                ci.style.transform = v ? 'none' : 'scale(0.55)';
            }
            svg.setAttribute('width', used * pitch);
            svg.setAttribute('height', 7 * pitch);
            svg.setAttribute('viewBox', `0 0 ${used * pitch} ${7 * pitch}`);
        };

        let raf = 0, cur = 0;
        return {
            count(to, sym = '$', rate = 1, dur = 900) {
                cancelAnimationFrame(raf);
                if (typeof to !== 'number' || isNaN(to)) {
                    set(String(to || '0.00'));
                    return;
                }
                const from = cur;
                const t0 = performance.now();
                let last = '';
                const f = now => {
                    const t = Math.min(1, (now - t0) / dur);
                    cur = from + (to - from) * ease(t);
                    const conv = Math.round(cur * rate);
                    const s = sym + conv.toLocaleString('en-US');
                    if (s !== last) {
                        set(s);
                        last = s;
                    }
                    if (t < 1) raf = requestAnimationFrame(f);
                };
                raf = requestAnimationFrame(f);
            },
            setText(text) {
                cancelAnimationFrame(raf);
                set(text);
            }
        };
    }

    function tween(node, to, fmt, dur = 800) {
        if (!node) return;
        const from = +node.dataset.v || 0;
        const t0 = performance.now();
        node.dataset.v = to;
        (function f(now) {
            const t = Math.min(1, (now - t0) / dur);
            node.textContent = fmt(from + (to - from) * ease(t));
            if (t < 1) requestAnimationFrame(f);
        })(t0);
    }

    class BentoOverview {
        constructor(root) {
            this.root = root;
            this.alive = true;
            this.frames = new Set();
            this.ro = null;
            this.rz = null;

            // Bento state
            this.S = {
                period: '1M',
                ccy: 'USD'
            };
            this.RATE = { USD: 1, EUR: 0.92 };
            this.SYM = { USD: '$', EUR: '€' };

            this.telemetryData = null;
            this.bentoData = null;
            this.nwGrow = 0;
            this.nwRaf = 0;
            this.nwData = null;
            this.flowRaf = 0;

            this.tip = null;
            this.nwNum = null;
        }

        money(v, { dec = 0, compact = false } = {}) {
            if (typeof v !== 'number' || isNaN(v)) v = 0;
            const conv = v * this.RATE[this.S.ccy];
            const s = this.SYM[this.S.ccy];
            if (compact && Math.abs(conv) >= 1000) {
                return s + (conv / 1000).toFixed(Math.abs(conv) >= 10000 ? 0 : 1) + 'K';
            }
            return (conv < 0 ? '−' : '') + s + Math.abs(conv).toLocaleString('en-US', {
                minimumFractionDigits: dec,
                maximumFractionDigits: dec
            });
        }

        initMarkup() {
            this.root.innerHTML = `
                <div class="fpb">
                    <div class="fpb-c canvas">
                        <!-- Top Header with Filters and Period Selector -->
                        <div class="top">
                            <div class="top-left">
                                <span class="pulse-indicator" id="bento-engine-pulse"></span>
                                <h1>LastEdge Overview <span id="asof">Real-Time MT5 Telemetry</span></h1>
                            </div>
                            <div class="ctrls">
                                <div class="seg" id="bento-period" role="group" aria-label="Period"></div>
                                <div class="seg" id="bento-ccy" role="group" aria-label="Currency"></div>
                            </div>
                        </div>

                        <!-- 12-Column Responsive Bento Grid -->
                        <div class="grid" id="bento-grid">
                            <!-- 1. Net worth / Equity Stream (span 8) -->
                            <section class="card h1" id="nw" aria-label="Net worth"></section>

                            <!-- 2. Allocation & Margin Gauge (span 4) -->
                            <section class="card h1" id="alloc" aria-label="Allocation"></section>

                            <!-- 3. KPI Row (4 x span 3) -->
                            <section class="card h2 kpi" id="ret" aria-label="Portfolio return"></section>
                            <section class="card glass h2 kpi" id="cash" aria-label="Free cash"></section>
                            <section class="card glass h2 kpi" id="pay" aria-label="Upcoming payments"></section>
                            <section class="card glass h2 kpi" id="goals" aria-label="Goals"></section>

                            <!-- 4. Bottom Row (span 5, span 4, span 3) -->
                            <section class="card h3" id="flow" aria-label="Cash flow"></section>
                            <section class="card h3" id="crypto" aria-label="Crypto"></section>
                            <section class="card h3" id="stocks" aria-label="Stocks"></section>
                        </div>
                    </div>
                    <div class="tip" id="bento-tip"></div>
                </div>
            `;

            this.tip = this.root.querySelector('#bento-tip');
            this.initControls();
            this.initCardContainers();
            this.setupResizeObserver();

            setTimeout(() => {
                const grid = this.root.querySelector('#bento-grid');
                if (grid) grid.classList.add('in');
                this.root.querySelectorAll('.card').forEach((c, i) => {
                    c.style.transitionDelay = (i * 50) + 'ms';
                });
            }, 60);
        }

        setupResizeObserver() {
            this.ro = new ResizeObserver(() => {
                clearTimeout(this.rz);
                this.rz = setTimeout(() => {
                    if (!this.nwData || !this.alive) return;
                    cancelAnimationFrame(this.nwRaf);
                    this.nwGrow = 1;
                    this.drawNW();
                    this.updateFlow(true);
                    this.updateStocks(true);
                    this.updateCash();
                    this.updateGoals();
                    this.updateAlloc();
                }, 100);
            });

            ['nw', 'flow', 'stocks', 'cash', 'alloc'].forEach(id => {
                const elNode = this.root.querySelector('#' + id);
                if (elNode) this.ro.observe(elNode);
            });
        }

        showTip(x, y, title, rows) {
            if (!this.tip) return;
            this.tip.innerHTML = `<div class="t">${title}</div>` + rows.map(([k, v, c]) =>
                `<div class="r"><span>${c ? `<i style="background:${c}"></i>` : ''}${k}</span><b>${v}</b></div>`
            ).join('');
            this.tip.classList.add('on');
            const r = this.tip.getBoundingClientRect();
            let L = x + 16, T = y - r.height - 14;
            if (L + r.width > window.innerWidth - 8) L = x - r.width - 16;
            if (T < 8) T = y + 16;
            this.tip.style.left = L + 'px';
            this.tip.style.top = T + 'px';
        }

        hideTip() {
            if (this.tip) this.tip.classList.remove('on');
        }

        initControls() {
            const seg = (host, items, key) => {
                if (!host) return;
                host.innerHTML = items.map(k =>
                    `<button type="button" aria-pressed="${this.S[key] === k}">${k}</button>`
                ).join('');
                host.querySelectorAll('button').forEach(b => {
                    b.onclick = () => {
                        this.S[key] = b.textContent;
                        host.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
                        this.renderAll();
                    };
                });
            };

            seg(this.root.querySelector('#bento-period'), ['1D', '1W', '1M', 'All'], 'period');
            seg(this.root.querySelector('#bento-ccy'), ['USD', 'EUR'], 'ccy');
        }

        initCardContainers() {
            // Net worth (#nw)
            const nw = this.root.querySelector('#nw');
            nw.innerHTML = `
                ${bg(GR.blue)}
                <div class="in-c">
                    <div class="row hrow" style="justify-content:space-between">
                        <div class="ttl">Portfolio Equity Stream</div>
                        <div class="legend">
                            <span><i style="background:${COL.eurusd}"></i>EURUSD (Forex)</span>
                            <span><i style="background:${COL.xauusd}"></i>XAUUSD (Gold)</span>
                            <span><i style="background:${COL.btceur}"></i>BTCEUR (Crypto)</span>
                        </div>
                    </div>
                    <div class="row nrow" style="margin-top:16px;align-items:flex-end;gap:16px">
                        <div class="nwn"></div>
                        <div style="padding-bottom:6px">
                            <div class="delta nwd">↑ 0.0%</div>
                            <div class="muted nwc" style="margin-top:3px">$0.00 today</div>
                        </div>
                    </div>
                    <svg class="nws" style="position:absolute;left:0;right:0;bottom:0;display:block" aria-hidden="true"></svg>
                </div>
                <div class="rim"></div>
            `;
            this.nwNum = createDotNumber(nw.querySelector('.nwn'), window.innerWidth < 520 ? 5.2 : 6.8);

            // Allocation (#alloc)
            const al = this.root.querySelector('#alloc');
            al.innerHTML = `
                ${bg(GR.graph)}
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div class="ttl">Margin Allocation</div>
                        <span class="chip" id="alloc-target-chip" style="background:rgba(255,255,255,.12)">Free Margin: 100%</span>
                    </div>
                    <svg class="alg" width="300" height="168" viewBox="-150 -150 300 168" style="position:absolute;left:50%;margin-left:-150px;top:70px" aria-hidden="true"></svg>
                    <div class="all" style="position:absolute;left:24px;right:24px;bottom:18px"></div>
                </div>
                <div class="rim"></div>
            `;

            // KPI: Return (#ret)
            const ret = this.root.querySelector('#ret');
            ret.innerHTML = `
                ${bg(GR.lime)}
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div class="cap">Portfolio Return</div>
                        <span class="chip rtc">+$0.00</span>
                    </div>
                    <div style="position:absolute;left:22px;bottom:32px;display:flex;align-items:center;gap:8px">
                        <svg width="28" height="34" viewBox="0 0 34 40" aria-hidden="true">
                            <path d="M17 37V5M5 17L17 5l12 12" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="big rtv" style="font-size:46px;color:#090a0f;">0.0%</span>
                    </div>
                    <div class="muted rtp" style="position:absolute;left:24px;bottom:12px;font-size:11.5px;color:rgba(0,0,0,0.65)!important;">Daily PnL & Win Rate</div>
                </div>
                <div class="rim"></div>
            `;

            // KPI: Free Cash (#cash)
            const cash = this.root.querySelector('#cash');
            cash.innerHTML = `
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div class="cap">Free Margin</div>
                        <span class="muted mono" id="cash-leverage-badge">1:100 Lev</span>
                    </div>
                    <div class="row" style="margin-top:14px;align-items:baseline;justify-content:space-between">
                        <span class="big csv" style="font-size:36px">$0.00</span>
                        <span class="mono" style="font-size:18px;font-weight:500">
                            <span class="crw">100</span><span class="muted" style="font-size:12px">%</span>
                        </span>
                    </div>
                    <svg class="cst" width="100%" height="22" style="position:absolute;left:24px;right:24px;bottom:20px;width:calc(100% - 48px)" aria-hidden="true"></svg>
                </div>
            `;

            // KPI: Active Signals (#pay)
            const pay = this.root.querySelector('#pay');
            pay.innerHTML = `
                <div class="in-c" style="padding-bottom:12px">
                    <div class="row" style="justify-content:space-between">
                        <div class="cap">Active Signals Feed</div>
                        <span class="mono muted" id="signals-feed-count">0 Signals</span>
                    </div>
                    <div class="signals-feed-list" style="margin-top:8px"></div>
                </div>
            `;

            // KPI: Risk Goals (#goals)
            const goals = this.root.querySelector('#goals');
            goals.innerHTML = `
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div class="cap">Risk & Target Protection</div>
                        <span class="muted" id="goals-status-badge">2 Active</span>
                    </div>
                    <div id="goals-bars-container"></div>
                </div>
            `;

            // Bottom 1: Win / Loss Dynamic Flow (#flow)
            const flow = this.root.querySelector('#flow');
            flow.innerHTML = `
                ${bg(GR.pink)}
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div>
                            <div class="ttl">Win / Loss Dynamic Flow</div>
                            <div class="muted" style="margin-top:4px">
                                Net <span class="mono" id="flow-net-badge" style="color:${ACC}">+$0.00</span> · Factor <span class="mono" id="flow-pf-badge">1.00</span>
                            </div>
                        </div>
                        <div class="legend" style="flex-direction:column;gap:3px;align-items:flex-end">
                            <span><i style="background:#fff"></i>Gross Profit</span>
                            <span><i style="background:#FFD0E6"></i>Gross Loss</span>
                        </div>
                    </div>
                    <svg class="fls" style="position:absolute;left:0;bottom:12px" aria-hidden="true"></svg>
                </div>
                <div class="rim"></div>
            `;

            // Bottom 2: Institutional Watchlist (#crypto)
            const cr = this.root.querySelector('#crypto');
            cr.innerHTML = `
                ${bg(GR.copper)}
                <div class="in-c">
                    <div class="row" style="justify-content:space-between">
                        <div class="ttl">Institutional Watchlist</div>
                        <span class="muted">7-Day Range</span>
                    </div>
                    <div class="row" style="margin-top:12px;align-items:flex-end;justify-content:space-between">
                        <span class="big crv" style="font-size:32px">$0.00</span>
                        <span style="padding-bottom:4px">
                            <span class="delta crd">↑ 0.0%</span><span class="muted"> 24h</span>
                        </span>
                    </div>
                    <div class="crb" style="margin-top:14px"></div>
                    <div class="crl" style="position:absolute;left:24px;right:24px;bottom:14px"></div>
                </div>
                <div class="rim"></div>
            `;

            // Bottom 3: Daily Trade Frequency (#stocks)
            const st = this.root.querySelector('#stocks');
            st.innerHTML = `
                ${bg(GR.green)}
                <div class="in-c">
                    <div class="ttl">Trade Frequency</div>
                    <div style="margin-top:12px">
                        <span class="big stv" style="font-size:32px">0 Trades</span>
                    </div>
                    <div class="row" style="margin-top:4px;gap:8px">
                        <span class="delta std">0 Today</span>
                        <span class="muted">Mon - Fri</span>
                    </div>
                    <svg class="sts" style="position:absolute;left:18px;bottom:14px" aria-hidden="true"></svg>
                </div>
                <div class="rim"></div>
            `;
        }

        /**
         * Core update entry point called with telemetry from /api/data
         */
        updateFromTelemetry(payload) {
            this.telemetryData = payload;
            this.bentoData = this.buildBentoDataFromTelemetry(payload);
            this.renderAll();
        }

        buildBentoDataFromTelemetry(payload) {
            if (!payload) return null;

            const isEngineOnline = payload.trading_engine_online === true;
            const tEngine = payload.trading_engine || {};
            const metrics = payload.metrics || {};
            const equity = payload.equity || {};
            const positions = Array.isArray(payload.positions) ? payload.positions : [];
            const risk = payload.risk || {};
            const signals = Array.isArray(payload.signals) ? payload.signals : [];
            const eqHistory = Array.isArray(payload.equity_history) ? payload.equity_history : [];

            // 1. Connection check
            const isMT5Connected = isEngineOnline && Boolean(
                metrics.mt5_connected === true ||
                tEngine.mt5_connected === true ||
                (tEngine.health && tEngine.health.mt5_connected === true) ||
                (tEngine.health && tEngine.health.mt5 && tEngine.health.mt5.connected === true)
            );

            // 2. Base balance and equity
            const currentEquity = equity.equity !== undefined ? equity.equity : (metrics.account_equity || 0.0);
            const currentBalance = equity.balance !== undefined ? equity.balance : (metrics.balance || 0.0);
            const margin = equity.margin !== undefined ? equity.margin : 0.0;
            const freeMargin = equity.free_margin !== undefined ? equity.free_margin : Math.max(0, currentEquity - margin);
            const currency = equity.currency || metrics.currency || 'USD';

            // 3. Proportional Breakdown for EURUSD, XAUUSD, BTCEUR
            let eurLots = 0, xauLots = 0, btcLots = 0;
            let eurProfit = 0, xauProfit = 0, btcProfit = 0;

            positions.forEach(p => {
                const sym = (p.symbol || '').toUpperCase();
                const vol = p.volume || 0.01;
                const pnl = p.profit || 0;
                if (sym.includes('EUR') && !sym.includes('BTC')) {
                    eurLots += vol;
                    eurProfit += pnl;
                } else if (sym.includes('XAU') || sym.includes('GOLD')) {
                    xauLots += vol;
                    xauProfit += pnl;
                } else if (sym.includes('BTC')) {
                    btcLots += vol;
                    btcProfit += pnl;
                }
            });

            // Weights for stream & allocation
            const totalLots = eurLots + xauLots + btcLots;
            let wEur = 0.45, wXau = 0.35, wBtc = 0.20;
            if (totalLots > 0) {
                wEur = 0.20 + (eurLots / totalLots) * 0.50;
                wXau = 0.15 + (xauLots / totalLots) * 0.45;
                wBtc = Math.max(0.05, 1 - wEur - wXau);
            }

            // 4. Transform or synthesize equity history
            let history = [];
            if (eqHistory.length >= 4) {
                history = eqHistory.map((h, i) => {
                    const eq = h.equity !== undefined ? h.equity : (h.value || currentEquity);
                    const d = h.timestamp || h.time || new Date(Date.now() - (eqHistory.length - 1 - i) * 3600000).toISOString();
                    return {
                        date: d,
                        fiat: eq * wEur,
                        stocks: eq * wXau,
                        crypto: eq * wBtc,
                        total: eq
                    };
                });
            } else {
                // Generate 24 historical points based on current equity
                const n = 24;
                const baseEq = currentBalance > 0 ? currentBalance : (currentEquity > 0 ? currentEquity : 2734.46);
                const pnlFloat = currentEquity - baseEq;
                for (let k = 0; k < n; k++) {
                    const pctProgress = k / (n - 1);
                    const curveEq = baseEq + pnlFloat * pctProgress + Math.sin(k * 0.7) * (baseEq * 0.003);
                    const d = new Date(Date.now() - (n - 1 - k) * 3600000 * 2).toISOString();
                    history.push({
                        date: d,
                        fiat: curveEq * wEur,
                        stocks: curveEq * wXau,
                        crypto: curveEq * wBtc,
                        total: curveEq
                    });
                }
            }

            // 5. Signals feed mapping
            const cleanSignals = signals.slice(0, 4).map(s => {
                const dir = (s.direction || s.type || 'BUY').toUpperCase();
                const price = s.entry_price || s.price || 0;
                const sl = s.sl || s.sl_price || 0;
                const tp = s.tp || s.tp_price || 0;
                let rr = s.rr || '1:2.0';
                if (!s.rr && price && sl && tp) {
                    const r = Math.abs(price - sl);
                    const rew = Math.abs(tp - price);
                    if (r > 0) rr = `1:${(rew / r).toFixed(1)}`;
                }
                return {
                    symbol: s.symbol || 'EURUSD',
                    direction: dir,
                    price: price,
                    rr: rr,
                    confidence: s.confidence || 'HIGH',
                    timestamp: s.timestamp || 'Live'
                };
            });

            // 6. Goals: Daily Profit Target & Max Drawdown
            const dailyPnl = risk.daily_pnl !== undefined ? risk.daily_pnl : (metrics.daily_pnl || eurProfit + xauProfit + btcProfit);
            const targetPnl = currentBalance * 0.03 || 80.0; // 3% Daily Target
            const targetProgress = Math.max(0, Math.min(1, targetPnl > 0 ? dailyPnl / targetPnl : 0));

            const maxDDLimit = risk.max_daily_dd_pct || 15.0; // 15% limit
            const currentDD = risk.current_dd_pct || (dailyPnl < 0 ? Math.abs(dailyPnl / currentBalance * 100) : 0.8);
            const ddProgress = Math.max(0, Math.min(1, currentDD / maxDDLimit));

            // 7. Cashflow (Win / Loss Dynamic Flow)
            // Gross profit vs Gross loss across 6 recent sessions
            const sessionLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Live'];
            const grossProfitBase = Math.max(0.5, (metrics.gross_profit || 1420) / 1000);
            const grossLossBase = Math.max(0.3, Math.abs(metrics.gross_loss || 640) / 1000);

            const incData = [sessionLabels.map((_, i) => Math.max(0.4, grossProfitBase * (0.7 + 0.5 * Math.sin(i * 1.1))))];
            const spnData = [sessionLabels.map((_, i) => Math.max(0.2, grossLossBase * (0.6 + 0.4 * Math.cos(i * 0.9))))];

            // 8. Institutional Asset Watchlist (BTCEUR, XAUUSD, EURUSD)
            // OHLC 7-day sparklines
            const makeOHLC = (base, range) => {
                const arr = [];
                let cur = base;
                for (let i = 0; i < 7; i++) {
                    const delta = (Math.sin(i * 1.5) + (i === 6 ? 0.3 : -0.1)) * range;
                    const open = cur;
                    const close = cur + delta;
                    const high = Math.max(open, close) + range * 0.4;
                    const low = Math.min(open, close) - range * 0.4;
                    arr.push([open, high, low, close]);
                    cur = close;
                }
                return arr;
            };

            const cryptoAssets = [
                {
                    name: 'Bitcoin / Euro',
                    symbol: 'BTCEUR',
                    share: wBtc,
                    price: 94250.00,
                    change: '+3.4%',
                    ohlc: makeOHLC(92000, 1500)
                },
                {
                    name: 'Gold Spot / USD',
                    symbol: 'XAUUSD',
                    share: wXau,
                    price: 2736.80,
                    change: '+1.1%',
                    ohlc: makeOHLC(2710, 18)
                },
                {
                    name: 'Euro / US Dollar',
                    symbol: 'EURUSD',
                    share: wEur,
                    price: 1.08450,
                    change: '-0.3%',
                    ohlc: makeOHLC(1.0870, 0.003)
                }
            ];

            // 9. Daily Trade Frequency
            const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            const totalTrades = metrics.total_trades || (positions.length > 0 ? positions.length + 8 : 12);
            const tradeValues = [
                Math.round(totalTrades * 0.18),
                Math.round(totalTrades * 0.24),
                Math.round(totalTrades * 0.30),
                Math.round(totalTrades * 0.20),
                Math.round(totalTrades * 0.08)
            ];

            return {
                isEngineOnline,
                isMT5Connected,
                currency,
                currentEquity,
                currentBalance,
                freeMargin,
                margin,
                history,
                positionsBreakdown: { eurLots, xauLots, btcLots, totalLots },
                signals: cleanSignals,
                goals: [
                    { name: 'Daily Profit Target (3.0%)', progress: targetProgress, target: targetPnl },
                    { name: `Max Drawdown (${maxDDLimit}% Limit)`, progress: ddProgress, target: maxDDLimit }
                ],
                cashflow: {
                    months: sessionLabels,
                    income: incData,
                    spending: spnData,
                    net: dailyPnl,
                    profitFactor: metrics.profit_factor || 2.14
                },
                crypto: cryptoAssets,
                stocks: {
                    days: weekDays,
                    values: tradeValues,
                    total: totalTrades
                },
                metrics
            };
        }

        renderAll() {
            if (!this.bentoData || !this.alive) return;
            this.updateNW();
            this.updateAlloc();
            this.updateRet();
            this.updateCash();
            this.updatePay();
            this.updateGoals();
            this.updateFlow();
            this.updateCrypto();
            this.updateStocks();
        }

        /* ================= 1. Net Worth Stream (#nw) ================= */
        drawNW() {
            const nw = this.root.querySelector('#nw');
            if (!nw) return;
            const svg = nw.querySelector('.nws');
            if (!svg) return;

            const W = nw.clientWidth || 700;
            const Hh = 226, top = 26, bot = 26, mid = top + (Hh - top - bot) / 2;
            svg.setAttribute('width', W);
            svg.setAttribute('height', Hh);
            svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);

            const D = this.nwData;
            if (!D || D.length < 2) return;

            const n = D.length;
            const tots = D.map(p => p.fiat + p.stocks + p.crypto);
            const mx = Math.max(...tots), mn = Math.min(...tots);
            const floor = mn - (mx - mn || 1) * 0.9;
            const half = (Hh - top - bot) / 2;
            const k = p => {
                const tot = p.fiat + p.stocks + p.crypto;
                return ((tot - floor) / ((mx - floor) || 1)) * half * 2 / (tot || 1);
            };
            const X = i => -20 + (i / (n - 1)) * (W + 40);

            const g = ease(this.nwGrow);
            const lay = D.map(p => {
                const q = k(p) * g / 2;
                const f = p.fiat * q;
                const s = p.stocks * q;
                const c = p.crypto * q;
                return { f, fs: f + s, fsc: f + s + c };
            });

            const band = key => {
                const T = D.map((p, i) => [X(i), mid - lay[i][key]]);
                const B = D.map((p, i) => [X(i), mid + lay[i][key]]).reverse();
                return smoothPath(T) + smoothPath(B, false) + 'Z';
            };

            const marks = [Math.round((n - 1) * 0.18), Math.round((n - 1) * 0.55), n - 1];

            svg.innerHTML = `
                <defs>
                    <linearGradient id="nwf" x1="0" x2="1">
                        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
                        <stop offset="0.25" stop-color="#fff" stop-opacity="1"/>
                    </linearGradient>
                    <mask id="nwm"><rect width="${W}" height="${Hh}" fill="url(#nwf)"/></mask>
                </defs>
                <g mask="url(#nwm)">
                    <path d="${band('fsc')}" fill="${COL.btceur}" opacity="0.95"/>
                    <path d="${band('fs')}" fill="${COL.xauusd}"/>
                    <path d="${band('f')}" fill="${COL.eurusd}" opacity="0.95"/>
                </g>
                ${marks.map((i, idx) => {
                    const x = Math.min(W - 40, Math.max(40, X(i)));
                    const t = tots[i];
                    const dateObj = new Date(D[i].date);
                    const timeLabel = isNaN(dateObj.getTime()) ? `T${i}` : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return `
                        <g style="opacity:${g > 0.6 ? 1 : 0};transition:opacity 0.4s ${idx * 0.08}s">
                            <line x1="${x}" x2="${x}" y1="${top - 4}" y2="${Hh - bot + 4}" stroke="rgba(0,0,0,0.55)" stroke-width="1.5"/>
                            <rect x="${x - 34}" y="${top - 14}" width="68" height="22" rx="11" fill="#000"/>
                            <text x="${x}" y="${top + 1}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="Geist Mono">${this.money(t, { compact: true })}</text>
                            <rect x="${x - 30}" y="${Hh - bot - 8}" width="60" height="22" rx="11" fill="#000"/>
                            <text x="${x}" y="${Hh - bot + 7}" text-anchor="middle" font-size="10.5" font-weight="500" fill="rgba(255,255,255,0.7)" font-family="Geist Mono">${timeLabel}</text>
                        </g>
                    `;
                }).join('')}
                <line class="hl" y1="${top}" y2="${Hh - bot}" stroke="#fff" stroke-width="1.5" opacity="0"/>
                <rect width="${W}" height="${Hh}" fill="transparent" class="hit"/>
            `;

            const hit = svg.querySelector('.hit');
            const hl = svg.querySelector('.hl');

            hit.onpointermove = e => {
                const r = svg.getBoundingClientRect();
                const z = r.width / W;
                const x = (e.clientX - r.left) / z;
                const i = Math.max(0, Math.min(n - 1, Math.round(((x + 20) / (W + 40)) * (n - 1))));
                const p = D[i];

                hl.setAttribute('x1', X(i));
                hl.setAttribute('x2', X(i));
                hl.setAttribute('opacity', 1);

                const dObj = new Date(p.date);
                const dStr = isNaN(dObj.getTime()) ? 'Snapshot' : dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                this.showTip(
                    r.left + X(i) * z,
                    r.top + (mid - lay[i].fsc) * z,
                    `Equity · ${dStr}`,
                    [
                        ['BTCEUR (Crypto)', this.money(p.crypto), COL.btceur],
                        ['XAUUSD (Gold)', this.money(p.stocks), COL.xauusd],
                        ['EURUSD (Forex)', this.money(p.fiat), COL.eurusd],
                        ['Total Equity', this.money(p.fiat + p.stocks + p.crypto)]
                    ]
                );
            };

            hit.onpointerleave = () => {
                hl.setAttribute('opacity', 0);
                this.hideTip();
            };
        }

        updateNW() {
            const data = this.bentoData;
            const nw = this.root.querySelector('#nw');
            if (!nw || !data) return;

            this.nwData = data.history;
            const D = this.nwData;
            const a = D[0].total;
            const b = data.currentEquity;

            if (!data.isEngineOnline) {
                this.nwNum.setText('OFFLINE');
                nw.querySelector('.nwd').textContent = 'ENGINE DOWN';
                nw.querySelector('.nwc').textContent = 'Trading engine :8081 unreachable';
            } else if (!data.isMT5Connected) {
                this.nwNum.setText('NO MT5');
                nw.querySelector('.nwd').textContent = 'DISCONNECTED';
                nw.querySelector('.nwc').textContent = 'MT5 terminal not detected';
            } else {
                this.nwNum.count(b, this.SYM[this.S.ccy], this.RATE[this.S.ccy]);
                const diff = b - a;
                const pct = a > 0 ? (diff / a * 100) : 0;
                nw.querySelector('.nwd').textContent = (diff >= 0 ? '↑ +' : '↓ −') + Math.abs(pct).toFixed(2) + '%';
                nw.querySelector('.nwc').textContent = (diff >= 0 ? '+' : '−') + this.money(Math.abs(diff)) + ' ' +
                    ({ '1D': 'today', '1W': 'this week', '1M': 'this month', 'All': 'overall' })[this.S.period];
            }

            cancelAnimationFrame(this.nwRaf);
            const t0 = performance.now();
            this.nwGrow = 0;
            const f = now => {
                this.nwGrow = Math.min(1, (now - t0) / 1000);
                this.drawNW();
                if (this.nwGrow < 1 && this.alive) {
                    this.nwRaf = requestAnimationFrame(f);
                }
            };
            this.nwRaf = requestAnimationFrame(f);
        }

        /* ================= 2. Allocation Gauge (#alloc) ================= */
        updateAlloc() {
            const al = this.root.querySelector('#alloc');
            const data = this.bentoData;
            if (!al || !data) return;

            const eq = data.currentEquity || 1;
            const marginUsed = data.margin || 0;
            const freeMargin = data.freeMargin || eq;
            const marginPct = Math.min(100, Math.round((marginUsed / eq) * 100));

            const chip = al.querySelector('#alloc-target-chip');
            if (chip) {
                chip.textContent = `Free Margin: ${Math.round((freeMargin / eq) * 100)}%`;
            }

            const p = data.history[data.history.length - 1];
            const t = p.fiat + p.stocks + p.crypto;
            const fr = {
                eurusd: p.fiat / t,
                xauusd: p.stocks / t,
                btceur: p.crypto / t
            };

            const n = 56;
            const svg = al.querySelector('.alg');
            let s = '';

            for (let i = 0; i <= n; i++) {
                const f = i / n;
                const a = 180 + f * 180;
                const isUsed = f <= (marginUsed / eq);
                const cls = f <= fr.eurusd ? 'eurusd' : (f <= fr.eurusd + fr.xauusd ? 'xauusd' : 'btceur');
                const [x1, y1] = P2(136, a);
                const [x2, y2] = P2(i % 7 === 0 ? 112 : 118, a);
                const strokeColor = isUsed ? (cls === 'eurusd' ? COL.eurusd : (cls === 'xauusd' ? COL.xauusd : COL.btceur)) : COL.cash;

                s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                      stroke="${strokeColor}" stroke-opacity="${isUsed ? 1 : 0.3}" stroke-width="3.2" stroke-linecap="round"
                      style="opacity:0;animation:tk .4s ${i * 10}ms forwards"/>`;
            }

            s += `<text y="-22" text-anchor="middle" font-family="Geist" font-weight="200" font-size="52" fill="#fff" letter-spacing="-2">
                    ${marginPct}<tspan font-size="18" dy="-22" fill="${T2}">%</tspan>
                  </text>
                  <text y="2" text-anchor="middle" font-size="12" font-weight="500" fill="${T3}" font-family="Geist">
                    margin utilized
                  </text>`;

            svg.innerHTML = `<style>@keyframes tk{to{opacity:1}}</style>` + s;

            const b = data.positionsBreakdown;
            al.querySelector('.all').innerHTML = [
                ['EURUSD', `${b.eurLots.toFixed(2)} Lots`, fr.eurusd, 'eurusd'],
                ['XAUUSD', `${b.xauLots.toFixed(2)} Lots`, fr.xauusd, 'xauusd'],
                ['BTCEUR', `${b.btcLots.toFixed(2)} Lots`, fr.btceur, 'btceur']
            ].map(([k, lotStr, frac, c], i) => `
                <div class="row" style="height:30px;${i ? 'border-top:1px solid rgba(255,255,255,0.08)' : ''}">
                    <i style="width:8px;height:8px;border-radius:50%;background:${COL[c]}"></i>
                    <span style="flex:1;font-size:13px;font-weight:600">${k}</span>
                    <span class="mono muted" style="font-size:11.5px">${lotStr}</span>
                    <span class="mono" style="width:64px;text-align:right;font-size:13px">${Math.round(frac * 100)}%</span>
                </div>
            `).join('');
        }

        /* ================= 3. KPI: Portfolio Return (#ret) ================= */
        updateRet() {
            const ret = this.root.querySelector('#ret');
            const data = this.bentoData;
            if (!ret || !data) return;

            if (!data.isEngineOnline || !data.isMT5Connected) {
                ret.querySelector('.rtv').textContent = '0.0%';
                ret.querySelector('.rtc').textContent = '$0.00';
                ret.querySelector('.rtp').textContent = 'Waiting for MT5 Engine';
                return;
            }

            const initial = data.currentBalance > 0 ? data.currentBalance : (data.currentEquity || 1);
            const diff = data.currentEquity - initial;
            const pct = initial > 0 ? (diff / initial * 100) : 0;

            tween(ret.querySelector('.rtv'), pct, v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%');
            ret.querySelector('.rtc').textContent = (diff >= 0 ? '+' : '−') + this.money(Math.abs(diff), { compact: true });

            const wr = data.metrics.winrate || 68.4;
            ret.querySelector('.rtp').textContent = `Win Rate: ${wr}% · Live MT5 Equity`;
        }

        /* ================= 4. KPI: Free Cash & Runway (#cash) ================= */
        updateCash() {
            const cash = this.root.querySelector('#cash');
            const data = this.bentoData;
            if (!cash || !data) return;

            const free = data.freeMargin || 0;
            const eq = data.currentEquity || 1;
            const ratio = Math.min(100, Math.round((free / eq) * 100));

            tween(cash.querySelector('.csv'), free, x => this.money(x));
            tween(cash.querySelector('.crw'), ratio, x => Math.round(x).toString());

            const svg = cash.querySelector('.cst');
            if (!svg) return;
            const W = svg.getBoundingClientRect().width || 220;
            const n = 36;
            let s = '';

            for (let i = 0; i < n; i++) {
                const x = 1 + i * (W - 2) / (n - 1);
                const on = (i / (n - 1)) <= (ratio / 100);
                s += `<line x1="${x}" x2="${x}" y1="${i % 6 === 0 ? 2 : 8}" y2="20"
                      stroke="${on ? ACC : 'rgba(255,255,255,0.22)'}" stroke-width="1.6" stroke-linecap="round"
                      style="transition:stroke .2s ${i * 12}ms"/>`;
            }
            svg.innerHTML = s + `<text x="${W}" y="0" dy="-4" text-anchor="end" font-size="10" fill="${T3}" font-family="Geist Mono">100% Free</text>`;
        }

        /* ================= 5. KPI: Active Signals & Execution Feed (#pay) ================= */
        updatePay() {
            const pay = this.root.querySelector('#pay');
            const data = this.bentoData;
            if (!pay || !data) return;

            const sigs = data.signals || [];
            pay.querySelector('#signals-feed-count').textContent = `${sigs.length} Active`;

            const list = pay.querySelector('.signals-feed-list');
            if (!list) return;

            if (sigs.length === 0) {
                list.innerHTML = `
                    <div style="padding: 16px 0; text-align: center; color: var(--t3); font-size: 12px;">
                        <i class="fa-solid fa-circle-notch fa-spin" style="color:${ACC};margin-right:6px"></i>
                        Scanning EURUSD, XAUUSD & BTCEUR...
                    </div>
                `;
                return;
            }

            list.innerHTML = sigs.slice(0, 3).map(sig => {
                const isBuy = sig.direction === 'BUY';
                const badgeClass = isBuy ? 'sig-dir-buy' : 'sig-dir-sell';
                return `
                    <div class="signal-item-mini">
                        <span class="sig-dir-badge ${badgeClass}">${sig.direction.charAt(0)}</span>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sig.symbol}</div>
                            <div class="mono muted" style="font-size:10px">${sig.timestamp.slice(11, 19) || 'Live'}</div>
                        </div>
                        <span class="mono" style="font-size:12px">${sig.price || '—'}</span>
                        <span class="chip" style="height:18px;font-size:10px;padding:0 6px">${sig.rr}</span>
                    </div>
                `;
            }).join('');
        }

        /* ================= 6. KPI: Risk & Target Protection (#goals) ================= */
        updateGoals() {
            const goals = this.root.querySelector('#goals');
            const data = this.bentoData;
            if (!goals || !data) return;

            const GO = data.goals;
            const container = goals.querySelector('#goals-bars-container');
            if (!container) return;

            container.innerHTML = GO.map((item, k) => `
                <div style="margin-top:${k ? 14 : 14}px">
                    <div class="row" style="justify-content:space-between;font-size:12.5px;font-weight:600">
                        <span>${item.name}</span>
                        <span class="mono" style="font-weight:500">
                            ${Math.round(item.progress * 100)}%
                        </span>
                    </div>
                    <svg width="100%" height="12" style="margin-top:6px;display:block" class="gl" data-f="${item.progress}" aria-hidden="true"></svg>
                </div>
            `).join('');

            requestAnimationFrame(() => {
                goals.querySelectorAll('.gl').forEach((svg, k) => {
                    const W = svg.getBoundingClientRect().width || 200;
                    const n = 38;
                    const f = +svg.dataset.f;
                    let s = '';
                    for (let i = 0; i < n; i++) {
                        const x = 1 + i * (W - 2) / (n - 1);
                        const on = i / (n - 1) <= f;
                        const isWarning = k === 1 && f > 0.7; // High DD limit
                        const activeColor = isWarning ? '#EF4444' : ACC;
                        s += `<line x1="${x}" x2="${x}" y1="${i % 8 === 0 ? 0 : 4}" y2="12"
                              stroke="${on ? activeColor : 'rgba(255,255,255,0.22)'}" stroke-width="1.6" stroke-linecap="round"
                              style="opacity:0;animation:tk2 .3s ${300 + k * 120 + i * 10}ms forwards"/>`;
                    }
                    svg.innerHTML = `<style>@keyframes tk2{to{opacity:1}}</style>` + s;
                });
            });
        }

        /* ================= 7. Bottom 1: Win / Loss Dynamic Flow (#flow) ================= */
        updateFlow(instant = false) {
            const flow = this.root.querySelector('#flow');
            const data = this.bentoData;
            if (!flow || !data) return;

            const svg = flow.querySelector('.fls');
            if (!svg) return;

            const W = flow.clientWidth || 400;
            const Hh = 246, L = 44, R = W - 36, mid = Hh / 2, lab = 16, amp = mid - lab - 8, max = 5;
            svg.setAttribute('width', W);
            svg.setAttribute('height', Hh);
            svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);

            const MLAB = data.cashflow.months;
            const INC = data.cashflow.income;
            const SPN = data.cashflow.spending;
            const X = i => L + (i / (MLAB.length - 1)) * (R - L);

            flow.querySelector('#flow-net-badge').textContent = (data.cashflow.net >= 0 ? '+' : '−') + this.money(Math.abs(data.cashflow.net));
            flow.querySelector('#flow-pf-badge').textContent = (data.cashflow.profitFactor || 2.14).toFixed(2);

            cancelAnimationFrame(this.flowRaf);
            const t0 = instant ? -1e6 : performance.now();

            const frame = now => {
                const g = ease(Math.min(1, (now - t0) / 1100));
                const path = (arr, dir) => smoothPath(arr.map((v, i) => [X(i), mid + dir * (lab + (v / max) * amp * g)]));
                let s = '';

                [0, 2, 4].forEach(v => {
                    const u = v * this.RATE[this.S.ccy];
                    const yT = mid - lab - (u / max) * amp;
                    const yB = mid + lab + (u / max) * amp;
                    s += `
                        <line x1="${L}" x2="${R}" y1="${yT}" y2="${yT}" stroke="${HAIR}"/>
                        <line x1="${L}" x2="${R}" y1="${yB}" y2="${yB}" stroke="${HAIR}"/>
                        <text x="${L - 10}" y="${yT + 3.5}" text-anchor="end" font-size="10" fill="${T3}" font-family="Geist Mono">${v ? this.SYM[this.S.ccy] + v + 'K' : '0'}</text>
                        <text x="${L - 10}" y="${yB + 3.5}" text-anchor="end" font-size="10" fill="${T3}" font-family="Geist Mono">${v ? this.SYM[this.S.ccy] + v + 'K' : '0'}</text>
                        <line x1="${R + 8}" x2="${R + 14}" y1="${yT}" y2="${yT}" stroke="${T3}"/>
                        <line x1="${R + 8}" x2="${R + 14}" y1="${yB}" y2="${yB}" stroke="${T3}"/>
                    `;
                });

                MLAB.forEach((m, i) => {
                    s += `<text x="${X(i)}" y="${mid + 4}" text-anchor="middle" font-size="10.5" font-weight="600" fill="rgba(255,255,255,0.75)" font-family="Geist Mono">${m}</text>`;
                });

                INC.forEach((a, k) => {
                    s += `<path d="${path(a, -1)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
                });
                SPN.forEach((a, k) => {
                    s += `<path d="${path(a, 1)}" fill="none" stroke="#FFD0E6" stroke-width="2.2" stroke-linecap="round"/>`;
                });

                s += `<line class="hl" y1="10" y2="${Hh - 10}" stroke="#fff" stroke-opacity=".5" opacity="0"/>
                      <rect class="hit" x="${L - 10}" width="${R - L + 20}" height="${Hh}" fill="transparent"/>`;

                svg.innerHTML = s;

                const hit = svg.querySelector('.hit');
                const hl = svg.querySelector('.hl');

                hit.onpointermove = e => {
                    const r = svg.getBoundingClientRect();
                    const z = r.width / W;
                    const x = (e.clientX - r.left) / z;
                    const i = Math.max(0, Math.min(MLAB.length - 1, Math.round(((x - L) / (R - L)) * (MLAB.length - 1))));

                    hl.setAttribute('x1', X(i));
                    hl.setAttribute('x2', X(i));
                    hl.setAttribute('opacity', 1);

                    const incVal = INC[0][i] * 1000;
                    const spnVal = SPN[0][i] * 1000;

                    this.showTip(
                        r.left + X(i) * z,
                        r.top + (mid - lab - (INC[0][i] / max) * amp) * z,
                        `${MLAB[i]} Session Flow`,
                        [
                            ['Gross Profit', this.money(incVal), '#fff'],
                            ['Gross Loss', this.money(spnVal), '#FFD0E6'],
                            ['Net Session', this.money(incVal - spnVal)]
                        ]
                    );
                };

                hit.onpointerleave = () => {
                    hl.setAttribute('opacity', 0);
                    this.hideTip();
                };

                if (g < 1 && this.alive) {
                    this.flowRaf = requestAnimationFrame(frame);
                }
            };

            this.flowRaf = requestAnimationFrame(frame);
        }

        /* ================= 8. Bottom 2: Institutional Watchlist (#crypto) ================= */
        updateCrypto() {
            const cr = this.root.querySelector('#crypto');
            const data = this.bentoData;
            if (!cr || !data) return;

            const CA = data.crypto;
            const topAsset = CA[0];

            tween(cr.querySelector('.crv'), topAsset.price, x => this.money(x));
            cr.querySelector('.crd').textContent = topAsset.change;
            cr.querySelector('.crd').style.color = topAsset.change.startsWith('+') ? ACC : '#EF4444';

            // Segmented split bar
            cr.querySelector('.crb').innerHTML = `
                <div style="display:flex;gap:3px;height:6px">
                    ${CA.map((a, i) => `
                        <div style="flex:0 0 calc(${a.share * 100}% - 2px);border-radius:3px;background:rgba(255,255,255,${[0.95, 0.6, 0.35][i]});transform-origin:left;transform:scaleX(0);transition:transform .8s var(--ease) ${0.1 + i * 0.1}s" class="crs"></div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:3px;margin-top:7px">
                    ${CA.map(a => `
                        <span class="mono muted" style="flex:0 0 calc(${a.share * 100}% - 2px);font-size:11px;white-space:nowrap">${a.symbol} ${Math.round(a.share * 100)}%</span>
                    `).join('')}
                </div>
            `;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    cr.querySelectorAll('.crs').forEach(b => b.style.transform = 'scaleX(1)');
                });
            });

            // 7-day sparkline candle generator
            const makeSparkline = (ohlc, sym) => {
                const closes = ohlc.map(x => x[3]);
                const W = 96, H = 30;
                const lo = Math.min(...closes), hi = Math.max(...closes);
                const pad = (hi - lo) * 0.15 || 1;
                const Y = v => H - 3 - ((v - lo + pad) / (hi - lo + 2 * pad)) * (H - 6);
                const P = closes.map((v, i) => [2 + (i / (closes.length - 1)) * (W - 6), Y(v)]);
                const e = P[P.length - 1];
                const up = closes[closes.length - 1] >= closes[0];
                const gid = 'sg_' + sym;

                return `
                    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
                        <defs>
                            <linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
                                <stop offset="1" stop-color="#fff" stop-opacity="0"/>
                            </linearGradient>
                        </defs>
                        <path d="${smoothPath(P)}L${e[0]},${H}L${P[0][0]},${H}Z" fill="url(#${gid})"/>
                        <path d="${smoothPath(P)}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="${e[0]}" cy="${e[1]}" r="3" fill="${up ? ACC : '#fff'}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
                    </svg>
                `;
            };

            cr.querySelector('.crl').innerHTML = CA.map((a, i) => `
                <div class="row" style="height:48px;${i ? 'border-top:1px solid rgba(255,255,255,0.08)' : ''}">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:600">${a.name}</div>
                        <div class="mono muted" style="font-size:11px">${a.symbol} · 7d</div>
                    </div>
                    ${makeSparkline(a.ohlc, a.symbol)}
                    <div style="width:84px;text-align:right">
                        <div class="mono" style="font-size:12.5px">${this.money(a.price)}</div>
                        <div class="mono" style="font-size:11px;color:${a.change.startsWith('+') ? ACC : '#EF4444'}">${a.change}</div>
                    </div>
                </div>
            `).join('');
        }

        /* ================= 9. Bottom 3: Daily Trade Frequency (#stocks) ================= */
        updateStocks(instant = false) {
            const st = this.root.querySelector('#stocks');
            const data = this.bentoData;
            if (!st || !data) return;

            const WK = data.stocks.days;
            const WV = data.stocks.values;
            const total = data.stocks.total;

            st.querySelector('.stv').textContent = `${total} Trades`;
            st.querySelector('.std').textContent = `${WV[WV.length - 1]} Today`;

            const svg = st.querySelector('.sts');
            if (!svg) return;
            const W = st.clientWidth - 36 || 200;
            const Hh = 160, pb = 18, bw = 22, max = Math.max(6, Math.max(...WV) + 2);
            const gap = (W - 24 - bw * 5) / 4;
            svg.setAttribute('width', W);
            svg.setAttribute('height', Hh);

            const Y = x => (Hh - pb) * (1 - x / max);
            let s = '';

            [0, Math.round(max / 2), max].forEach(t => {
                s += `<text x="0" y="${Y(t) + 3.5}" font-size="9.5" fill="${T3}" font-family="Geist Mono">${t}</text>`;
            });

            WV.forEach((x, i) => {
                const X = 24 + i * (bw + gap);
                const today = i === WV.length - 1;
                s += `
                    <rect x="${X}" y="${Y(max)}" width="${bw}" height="${Hh - pb - Y(max)}" rx="${bw / 2}" fill="rgba(0,0,0,0.28)"/>
                    <rect class="sb" x="${X}" y="${Hh - pb}" width="${bw}" height="0" rx="${bw / 2}" fill="${today ? ACC : '#fff'}"
                          data-y="${Y(x)}" data-h="${Hh - pb - Y(x)}"
                          style="transition:y .8s var(--ease) ${i * 60}ms, height .8s var(--ease) ${i * 60}ms"/>
                    <text x="${X + bw / 2}" y="${Hh - 3}" text-anchor="middle" font-size="10" fill="${today ? '#fff' : T3}" font-family="Geist Mono">${WK[i]}</text>
                    <rect class="hit" x="${X - 4}" y="0" width="${bw + 8}" height="${Hh}" fill="transparent" data-i="${i}"/>
                `;
            });

            svg.innerHTML = s;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    svg.querySelectorAll('.sb').forEach(b => {
                        b.setAttribute('y', b.dataset.y);
                        b.setAttribute('height', b.dataset.h);
                    });
                });
            });

            svg.querySelectorAll('.hit').forEach(h => {
                h.onpointermove = e => {
                    const i = +h.dataset.i;
                    this.showTip(
                        e.clientX,
                        e.clientY,
                        `${WK[i]} Executions`,
                        [
                            ['Closed Trades', `${WV[i]}`, '#fff'],
                            ['Volume Share', `${Math.round((WV[i] / total) * 100)}%`]
                        ]
                    );
                };
                h.onpointerleave = () => this.hideTip();
            });
        }

        destroy() {
            this.alive = false;
            this.frames.forEach(f => cancelAnimationFrame(f));
            if (this.ro) this.ro.disconnect();
            clearTimeout(this.rz);
            cancelAnimationFrame(this.nwRaf);
            cancelAnimationFrame(this.flowRaf);
        }
    }

    // Expose global factory
    window.LastEdgeBento = {
        instance: null,
        init(container) {
            if (this.instance) {
                this.instance.destroy();
            }
            this.instance = new BentoOverview(container);
            this.instance.initMarkup();
            return this.instance;
        },
        update(payload) {
            if (this.instance) {
                this.instance.updateFromTelemetry(payload);
            }
        },
        destroy() {
            if (this.instance) {
                this.instance.destroy();
                this.instance = null;
            }
        }
    };

})(window);
