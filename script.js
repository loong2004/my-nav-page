// ==========================================================
// 奶蛙de个人主页 · 纯原生交互脚本
// 包括：Web Audio 触感音效、双主题圆形揭幕、安全算式与命令搜索、
// 机械滚轮/LED 双模时钟与太阳轨迹、3D 视差入口、联动唱臂黑胶台、2D 矩阵放大镜、网络监测
// ==========================================================

'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');

// ---------- 通用工具 ----------
function svgIcon(name, extraClass = '') {
    return `<svg class="ui-icon${extraClass ? ' ' + extraClass : ''}" aria-hidden="true"><use href="#ic-${name}"></use></svg>`;
}

function setSvgIcon(svgEl, name) {
    const use = svgEl && svgEl.querySelector('use');
    if (use) use.setAttribute('href', `#ic-${name}`);
}

function onMediaChange(mql, handler) {
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else if (mql.addListener) mql.addListener(handler);
}

function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

async function fetchJsonWithRetry(url, options = {}, config = {}) {
    const timeout = config.timeout ?? 5000;
    const retries = config.retries ?? 1;
    const retryDelay = config.retryDelay ?? 300;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options, timeout);
            if (!response.ok) {
                const error = new Error(`HTTP_${response.status}`);
                error.status = response.status;
                throw error;
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    throw lastError;
}

function readStorage(key, fallback) {
    try {
        const val = localStorage.getItem(key);
        return val === null ? fallback : val;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // 隐私模式下忽略存储错误
    }
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return Promise.resolve();
}

function replayAnimation(el, className) {
    if (!el || reducedMotion.matches) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

function moveLiquidGlider(gliderEl, activeTab, animate = true) {
    if (!gliderEl || !activeTab) return;
    const nextLeft = activeTab.offsetLeft;
    const nextWidth = activeTab.offsetWidth;
    const prevTransform = gliderEl.style.transform;
    const nextTransform = `translate3d(${nextLeft}px, 0, 0)`;

    gliderEl.style.width = `${nextWidth}px`;
    gliderEl.style.transform = nextTransform;

    if (animate && prevTransform && prevTransform !== nextTransform) {
        const pill = gliderEl.querySelector('.glider-pill');
        replayAnimation(pill, 'is-stretching');
    }
}

// ==========================================================
// 0. Web Audio 微交互音效合成器（零外部音频文件）
// ==========================================================
const SoundEngine = (() => {
    const KEY = 'atelier_sound';
    let enabled = readStorage(KEY, 'true') !== 'false';
    let ctx = null;
    let lastTickAt = 0;

    function getCtx() {
        if (!enabled) return null;
        if (!ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            ctx = new Ctor();
        }
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        return ctx;
    }

    function syncButton() {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        btn.classList.toggle('is-muted', !enabled);
        btn.setAttribute('aria-pressed', String(enabled));
        btn.title = enabled ? '微交互音效：开（点击静音）' : '微交互音效：关（点击开启）';
    }

    function tick(freq = 1150, dur = 0.016) {
        const nowMs = performance.now();
        if (nowMs - lastTickAt < 38) return;
        lastTickAt = nowMs;
        const c = getCtx();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + dur);
        gain.gain.setValueAtTime(0.028, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + dur + 0.005);
    }

    function click(up = true) {
        const c = getCtx();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(up ? 540 : 420, t);
        osc.frequency.exponentialRampToValueAtTime(up ? 760 : 280, t + 0.026);
        gain.gain.setValueAtTime(0.036, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.035);
    }

    function chime() {
        const c = getCtx();
        if (!c) return;
        const t = c.currentTime;
        [523.25, 783.99].forEach((freq, i) => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            const start = t + i * 0.055;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.032, start);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(start);
            osc.stop(start + 0.17);
        });
    }

    function toggle() {
        enabled = !enabled;
        writeStorage(KEY, String(enabled));
        syncButton();
        if (enabled) chime();
    }

    function init() {
        syncButton();
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.addEventListener('click', toggle);
    }

    return { init, toggle, tick, click, chime, isEnabled: () => enabled };
})();

// ==========================================================
// 1. 双主题切换（支持 View Transitions 圆形揭幕动画）
// ==========================================================
const ThemeSystem = (() => {
    const KEY = 'atelier_theme';

    function applyTheme(theme) {
        const root = document.documentElement;
        root.dataset.theme = theme;
        writeStorage(KEY, theme);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'light' ? '#f2efe9' : '#0a0a0d');
    }

    function toggle(originEvent) {
        const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        SoundEngine.click(next === 'light');

        const toggleBtn = document.getElementById('theme-toggle');
        let x = window.innerWidth / 2;
        let y = 32;
        if (originEvent && typeof originEvent.clientX === 'number' && originEvent.clientX > 0) {
            x = originEvent.clientX;
            y = originEvent.clientY;
        } else if (toggleBtn) {
            const r = toggleBtn.getBoundingClientRect();
            x = r.left + r.width / 2;
            y = r.top + r.height / 2;
        }

        if (!document.startViewTransition || reducedMotion.matches) {
            applyTheme(next);
            return;
        }

        const maxRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );
        const root = document.documentElement;
        root.dataset.themeTransition = 'true';

        const transition = document.startViewTransition(() => {
            applyTheme(next);
        });

        transition.ready
            .then(() => {
                root.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${maxRadius}px at ${x}px ${y}px)`
                        ]
                    },
                    {
                        duration: 520,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        pseudoElement: '::view-transition-new(root)'
                    }
                );
            })
            .catch(() => {});

        transition.finished.finally(() => {
            delete root.dataset.themeTransition;
        });
    }

    function init() {
        const saved = readStorage(KEY, 'dark') === 'light' ? 'light' : 'dark';
        applyTheme(saved);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.addEventListener('click', toggle);
    }

    return { init, toggle };
})();

// ==========================================================
// 2. 顶部磨砂随滚切换 + 环境光场 + 聚光边框 + 3D 卡片 + 磁性悬停
// ==========================================================
function initSpatialInteractions() {
    const ambient = document.getElementById('ambient-bg');
    const desk = document.querySelector('.bento-desk');
    const cards = Array.from(document.querySelectorAll('.bento-card'));

    // 滚动超过 10px 时激活顶部渐进磨砂层与液态玻璃顶栏折射
    function syncScrolledState() {
        document.body.classList.toggle('is-scrolled', window.scrollY > 10);
    }
    syncScrolledState();
    window.addEventListener('scroll', syncScrolledState, { passive: true });

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let ambRaf = null;

    function tickAmbient() {
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;
        if (ambient) {
            ambient.style.setProperty('--amb-x', `${curX.toFixed(2)}px`);
            ambient.style.setProperty('--amb-y', `${curY.toFixed(2)}px`);
        }
        if (Math.abs(targetX - curX) > 0.08 || Math.abs(targetY - curY) > 0.08) {
            ambRaf = requestAnimationFrame(tickAmbient);
        } else {
            ambRaf = null;
        }
    }

    let pointerX = -9999;
    let pointerY = -9999;
    let spotRaf = null;

    function updateSpotlights() {
        spotRaf = null;
        if (desk) desk.classList.add('has-pointer');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${(pointerX - rect.left).toFixed(1)}px`);
            card.style.setProperty('--my', `${(pointerY - rect.top).toFixed(1)}px`);
        });
    }

    document.addEventListener('pointermove', e => {
        if (!hoverCapable.matches || reducedMotion.matches || document.hidden) return;
        pointerX = e.clientX;
        pointerY = e.clientY;
        if (!spotRaf) spotRaf = requestAnimationFrame(updateSpotlights);

        if (ambient) {
            targetX = ((e.clientX / window.innerWidth) - 0.5) * 44;
            targetY = ((e.clientY / window.innerHeight) - 0.5) * 36;
            if (!ambRaf) ambRaf = requestAnimationFrame(tickAmbient);
        }
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
        if (desk) desk.classList.remove('has-pointer');
    });

    // 3D Portal 卡片倾角 + 高光折射
    document.querySelectorAll('.portal-card').forEach(card => {
        let tiltRaf = null;
        let lastEvent = null;

        function applyTilt() {
            tiltRaf = null;
            if (!lastEvent) return;
            const rect = card.getBoundingClientRect();
            const px = (lastEvent.clientX - rect.left) / rect.width;
            const py = (lastEvent.clientY - rect.top) / rect.height;
            const rx = (0.5 - py) * 9;
            const ry = (px - 0.5) * 9;
            card.classList.add('is-tilting');
            card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
            card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
            card.style.setProperty('--ps', '1.012');
            card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
            card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
        }

        card.addEventListener('pointermove', e => {
            if (!hoverCapable.matches || reducedMotion.matches) return;
            lastEvent = e;
            if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
        }, { passive: true });

        card.addEventListener('pointerleave', () => {
            lastEvent = null;
            if (tiltRaf) {
                cancelAnimationFrame(tiltRaf);
                tiltRaf = null;
            }
            card.classList.remove('is-tilting');
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
            card.style.setProperty('--ps', '1');
        });
    });

    // 磁性悬停按钮
    document.querySelectorAll('.magnetic').forEach(el => {
        el.addEventListener('pointermove', e => {
            if (!hoverCapable.matches || reducedMotion.matches) return;
            const rect = el.getBoundingClientRect();
            const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
            const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
            el.style.setProperty('--mag-x', `${Math.max(-6, Math.min(6, dx)).toFixed(1)}px`);
            el.style.setProperty('--mag-y', `${Math.max(-5, Math.min(5, dy)).toFixed(1)}px`);
        }, { passive: true });

        el.addEventListener('pointerleave', () => {
            el.style.setProperty('--mag-x', '0px');
            el.style.setProperty('--mag-y', '0px');
        });
    });
}

// ==========================================================
// 3. 安全四则与科学算式求值器（Shunting-Yard，绝不用 eval）
// ==========================================================
function evaluateMath(raw) {
    const input = raw.trim();
    if (!input || input.length > 96) return null;
    if (!/[+\-*/%^()]|\b(sqrt|sin|cos|tan|abs|round|floor|ceil|log|ln|pi)\b/i.test(input)) {
        return null;
    }

    const tokens = [];
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) {
            let numStr = '';
            while (i < input.length && /[0-9.]/.test(input[i])) numStr += input[i++];
            if ((numStr.match(/\./g) || []).length > 1 || numStr === '.') return null;
            tokens.push({ type: 'num', value: parseFloat(numStr) });
            continue;
        }
        if (/[a-zA-Zπ]/.test(ch)) {
            let word = '';
            while (i < input.length && /[a-zA-Zπ]/.test(input[i])) word += input[i++];
            const lower = word.toLowerCase();
            if (lower === 'pi' || word === 'π') {
                tokens.push({ type: 'num', value: Math.PI });
            } else if (lower === 'e') {
                tokens.push({ type: 'num', value: Math.E });
            } else if (['sqrt', 'sin', 'cos', 'tan', 'abs', 'round', 'floor', 'ceil', 'log', 'ln'].includes(lower)) {
                tokens.push({ type: 'fn', value: lower });
            } else {
                return null;
            }
            continue;
        }
        if ('+-*/%^'.includes(ch)) {
            const prev = tokens[tokens.length - 1];
            const isUnary = !prev || prev.type === 'op' || prev.type === 'lparen' || prev.type === 'fn';
            if (isUnary && (ch === '+' || ch === '-')) {
                tokens.push({ type: 'op', value: ch === '-' ? 'u-' : 'u+' });
            } else {
                tokens.push({ type: 'op', value: ch });
            }
            i++;
            continue;
        }
        if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        return null;
    }

    if (!tokens.length) return null;

    const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u+': 3, 'u-': 3, '^': 4 };
    const rightAssoc = { '^': true, 'u+': true, 'u-': true };
    const out = [];
    const stack = [];

    for (const tok of tokens) {
        if (tok.type === 'num') {
            out.push(tok);
        } else if (tok.type === 'fn') {
            stack.push(tok);
        } else if (tok.type === 'op') {
            while (stack.length) {
                const top = stack[stack.length - 1];
                if (
                    (top.type === 'fn') ||
                    (top.type === 'op' && (prec[top.value] > prec[tok.value] || (prec[top.value] === prec[tok.value] && !rightAssoc[tok.value])))
                ) {
                    out.push(stack.pop());
                } else {
                    break;
                }
            }
            stack.push(tok);
        } else if (tok.type === 'lparen') {
            stack.push(tok);
        } else if (tok.type === 'rparen') {
            while (stack.length && stack[stack.length - 1].type !== 'lparen') {
                out.push(stack.pop());
            }
            if (!stack.length) return null;
            stack.pop();
            if (stack.length && stack[stack.length - 1].type === 'fn') {
                out.push(stack.pop());
            }
        }
    }

    while (stack.length) {
        const top = stack.pop();
        if (top.type === 'lparen' || top.type === 'rparen') return null;
        out.push(top);
    }

    const evalStack = [];
    for (const tok of out) {
        if (tok.type === 'num') {
            evalStack.push(tok.value);
        } else if (tok.type === 'op') {
            if (tok.value === 'u+' || tok.value === 'u-') {
                if (evalStack.length < 1) return null;
                const a = evalStack.pop();
                evalStack.push(tok.value === 'u-' ? -a : a);
            } else {
                if (evalStack.length < 2) return null;
                const b = evalStack.pop();
                const a = evalStack.pop();
                if (tok.value === '+') evalStack.push(a + b);
                else if (tok.value === '-') evalStack.push(a - b);
                else if (tok.value === '*') evalStack.push(a * b);
                else if (tok.value === '/') {
                    if (b === 0) return null;
                    evalStack.push(a / b);
                } else if (tok.value === '%') {
                    if (b === 0) return null;
                    evalStack.push(a % b);
                } else if (tok.value === '^') {
                    evalStack.push(Math.pow(a, b));
                }
            }
        } else if (tok.type === 'fn') {
            if (evalStack.length < 1) return null;
            const a = evalStack.pop();
            const map = {
                sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
                abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
                log: Math.log10, ln: Math.log
            };
            evalStack.push(map[tok.value](a));
        }
    }

    if (evalStack.length !== 1) return null;
    const result = evalStack[0];
    if (!Number.isFinite(result)) return null;

    const clean = Number(result.toPrecision(12));
    const formatted = Math.abs(clean) >= 1000 && Number.isInteger(clean)
        ? clean.toLocaleString('en-US')
        : String(clean);
    return { raw: String(clean), formatted };
}

// ==========================================================
// 4. 全能搜索 Omnibar（算式、斜杠命令、搜索历史、⌘K 唤起）
// ==========================================================
const searchEngines = {
    bing: { label: 'Bing', url: 'https://www.bing.com/search?q=', icon: 'bing', placeholder: '搜索、算式，或输入 / 命令...' },
    google: { label: 'Google', url: 'https://www.google.com/search?q=', icon: 'google', placeholder: '用 Google 搜索、算式或 / 命令...' },
    baidu: { label: 'Baidu', url: 'https://www.baidu.com/s?wd=', icon: 'baidu', placeholder: '百度一下，或输入算式 / 命令...' },
    duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: 'ddg', placeholder: '隐私搜索、算式或 / 命令...' }
};

const ENGINE_KEYS = Object.keys(searchEngines);
const ENGINE_STORAGE_KEY = 'atelier_engine';
const RECENT_STORAGE_KEY = 'atelier_recent_searches';

let currentEngine = readStorage(ENGINE_STORAGE_KEY, 'bing');
if (!searchEngines[currentEngine]) currentEngine = 'bing';

const deskActions = {
    togglePlay: () => {},
    nextTrack: () => {},
    refreshQuote: () => {},
    rescanNetwork: () => {},
    rescanPortals: () => {}
};

function getCommands() {
    return [
        { cmd: '/blog', title: '打开个人博客', sub: 'monki.de5.net', icon: 'rss', shortcut: '⌥1', run: () => window.open('https://monki.de5.net', '_blank', 'noopener') },
        { cmd: '/pic', title: '打开个人图床', sub: 'pic.soomin.de5.net', icon: 'image', shortcut: '⌥2', run: () => window.open('https://pic.soomin.de5.net', '_blank', 'noopener') },
        { cmd: '/news', title: '打开每日热点', sub: 'news.885123.xyz', icon: 'news', shortcut: '⌥3', run: () => window.open('https://news.885123.xyz', '_blank', 'noopener') },
        { cmd: '/play', title: '播放 / 暂停音乐', sub: '控制黑胶唱机状态', icon: 'disc', shortcut: '', run: () => deskActions.togglePlay() },
        { cmd: '/next', title: '切换下一首歌', sub: '从歌单随机或顺序切歌', icon: 'next', shortcut: '', run: () => deskActions.nextTrack() },
        { cmd: '/theme', title: '切换曜石 / 云石主题', sub: '圆形扩散切换深浅色界面', icon: 'theme', shortcut: '', run: e => ThemeSystem.toggle(e) },
        { cmd: '/sound', title: '开启 / 关闭微交互音效', sub: 'Web Audio 机械按键声效', icon: 'volume', shortcut: '', run: () => SoundEngine.toggle() },
        { cmd: '/quote', title: '换一句一言语录', sub: '重新获取随机语录', icon: 'refresh', shortcut: '', run: () => deskActions.refreshQuote() },
        { cmd: '/ping', title: '重新探测全部节点与入口', sub: '刷新网络状态及快捷入口延迟', icon: 'radar', shortcut: '', run: () => { deskActions.rescanNetwork(); deskActions.rescanPortals(); } }
    ];
}

function initSearchAndCommands() {
    const engineTabs = Array.from(document.querySelectorAll('.engine-tab'));
    const engineGlider = document.getElementById('engine-glider');
    const engineIcon = document.getElementById('current-engine-icon');
    const searchBox = document.getElementById('search-box');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const searchBtn = document.getElementById('search-btn');
    const dropdown = document.getElementById('omni-dropdown');
    const omnibarWrap = document.getElementById('omnibar');

    let recentSearches = (() => {
        try {
            const parsed = JSON.parse(readStorage(RECENT_STORAGE_KEY, '[]'));
            return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
        } catch {
            return [];
        }
    })();

    let omniItems = [];
    let omniActiveIndex = -1;
    let dropdownOpen = false;

    function saveRecent() {
        writeStorage(RECENT_STORAGE_KEY, JSON.stringify(recentSearches.slice(0, 5)));
    }

    function pushRecent(q) {
        recentSearches = [q, ...recentSearches.filter(item => item !== q)].slice(0, 5);
        saveRecent();
    }

    function selectEngine(key, shouldFocus = false, animate = true) {
        if (!searchEngines[key]) return;
        currentEngine = key;
        writeStorage(ENGINE_STORAGE_KEY, key);

        const cfg = searchEngines[key];
        if (engineIcon) setSvgIcon(engineIcon, cfg.icon);
        if (searchInput) searchInput.placeholder = cfg.placeholder;

        let activeTab = null;
        engineTabs.forEach(tab => {
            const active = tab.dataset.engine === key;
            tab.setAttribute('aria-selected', String(active));
            if (active) activeTab = tab;
        });
        moveLiquidGlider(engineGlider, activeTab, animate);

        if (shouldFocus && searchInput) searchInput.focus();
    }

    function cycleEngine(step) {
        const idx = ENGINE_KEYS.indexOf(currentEngine);
        const nextIdx = (idx + step + ENGINE_KEYS.length) % ENGINE_KEYS.length;
        SoundEngine.tick(960, 0.016);
        selectEngine(ENGINE_KEYS[nextIdx], false, true);
    }

    function setDropdownVisible(visible) {
        if (!dropdown || !searchInput) return;
        dropdownOpen = visible;
        dropdown.hidden = !visible;
        searchInput.setAttribute('aria-expanded', String(visible));
        if (!visible) omniActiveIndex = -1;
    }

    function buildOmniItems(showCommandsWhenEmpty = false) {
        const q = searchInput ? searchInput.value.trim() : '';
        const items = [];

        const math = evaluateMath(q);
        if (math) {
            items.push({
                kind: 'math',
                title: `= ${math.formatted}`,
                sub: '回车或点击复制计算结果',
                icon: 'calc',
                kbd: '复制',
                run: () => {
                    copyText(math.raw);
                    SoundEngine.chime();
                    const row = dropdown.querySelector('.omni-item.is-math .omni-item-sub');
                    if (row) row.textContent = '✓ 已复制到剪贴板';
                }
            });
        }

        if (q.startsWith('/')) {
            const kw = q.toLowerCase();
            getCommands()
                .filter(c => c.cmd.includes(kw) || c.title.toLowerCase().includes(kw))
                .forEach(c => {
                    items.push({
                        kind: 'cmd',
                        title: `${c.cmd} · ${c.title}`,
                        sub: c.sub,
                        icon: c.icon,
                        kbd: c.shortcut || '执行',
                        run: e => {
                            SoundEngine.chime();
                            c.run(e);
                            if (searchInput) { searchInput.value = ''; syncClearBtn(); }
                            setDropdownVisible(false);
                        }
                    });
                });
        } else if (!q) {
            recentSearches.forEach(term => {
                items.push({
                    kind: 'recent',
                    term,
                    title: term,
                    sub: `使用 ${searchEngines[currentEngine].label} 再次搜索`,
                    icon: 'clock',
                    kbd: '',
                    run: () => {
                        if (searchInput) searchInput.value = term;
                        executeSearch(term);
                    }
                });
            });

            if (showCommandsWhenEmpty || !recentSearches.length) {
                getCommands().slice(0, showCommandsWhenEmpty ? 9 : 4).forEach(c => {
                    items.push({
                        kind: 'cmd',
                        title: `${c.cmd} · ${c.title}`,
                        sub: c.sub,
                        icon: c.icon,
                        kbd: c.shortcut || '',
                        run: e => {
                            SoundEngine.chime();
                            c.run(e);
                            setDropdownVisible(false);
                        }
                    });
                });
            }
        }

        return items;
    }

    function renderDropdown(showCommandsWhenEmpty = false) {
        if (!dropdown) return;
        omniItems = buildOmniItems(showCommandsWhenEmpty);
        if (!omniItems.length) {
            setDropdownVisible(false);
            return;
        }

        const q = searchInput ? searchInput.value.trim() : '';
        const frag = document.createDocumentFragment();
        let addedRecentHead = false;
        let addedCmdHead = false;

        omniItems.forEach((item, idx) => {
            if (!q && item.kind === 'recent' && !addedRecentHead) {
                addedRecentHead = true;
                const head = document.createElement('div');
                head.className = 'omni-section-head';
                head.innerHTML = '<span>最近搜索</span>';
                const clr = document.createElement('button');
                clr.type = 'button';
                clr.className = 'omni-clear-hist';
                clr.textContent = '清空';
                clr.addEventListener('click', e => {
                    e.stopPropagation();
                    recentSearches = [];
                    saveRecent();
                    renderDropdown(showCommandsWhenEmpty);
                });
                head.appendChild(clr);
                frag.appendChild(head);
            } else if (!q && item.kind === 'cmd' && !addedCmdHead) {
                addedCmdHead = true;
                const head = document.createElement('div');
                head.className = 'omni-section-head';
                head.innerHTML = '<span>快捷命令</span>';
                frag.appendChild(head);
            }

            const row = document.createElement('div');
            row.className = `omni-item${item.kind === 'math' ? ' is-math' : ''}${idx === omniActiveIndex ? ' is-active' : ''}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(idx === omniActiveIndex));
            row.tabIndex = -1;

            row.innerHTML = `
                <span class="omni-item-icon">${svgIcon(item.icon)}</span>
                <span class="omni-item-main">
                    <span class="omni-item-title"></span>
                    <span class="omni-item-sub"></span>
                </span>
                ${item.kbd ? `<span class="omni-item-kbd">${item.kbd}</span>` : ''}
            `;
            row.querySelector('.omni-item-title').textContent = item.title;
            row.querySelector('.omni-item-sub').textContent = item.sub;

            if (item.kind === 'recent') {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'omni-del';
                del.setAttribute('aria-label', '删除该历史记录');
                del.innerHTML = svgIcon('close');
                del.addEventListener('click', e => {
                    e.stopPropagation();
                    recentSearches = recentSearches.filter(t => t !== item.term);
                    saveRecent();
                    renderDropdown(showCommandsWhenEmpty);
                });
                row.appendChild(del);
            }

            row.addEventListener('pointerdown', e => e.preventDefault());
            row.addEventListener('click', e => item.run(e));
            frag.appendChild(row);
        });

        dropdown.replaceChildren(frag);
        setDropdownVisible(true);
    }

    function syncClearBtn() {
        if (searchClear && searchInput) {
            searchClear.hidden = searchInput.value.length === 0;
        }
    }

    function summonOmnibar(showCommands = false) {
        if (!searchInput) return;
        if (window.scrollY > 120 && omnibarWrap) {
            omnibarWrap.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        }
        searchInput.focus();
        searchInput.select();
        replayAnimation(searchBox, 'is-summoned');
        renderDropdown(showCommands);
        SoundEngine.click(true);
    }

    function executeSearch(customQuery) {
        const query = (customQuery ?? (searchInput ? searchInput.value : '')).trim();
        if (!query) {
            if (searchInput) searchInput.focus();
            return;
        }

        const matchedCmd = getCommands().find(c => c.cmd === query.toLowerCase());
        if (matchedCmd) {
            SoundEngine.chime();
            matchedCmd.run();
            if (searchInput) { searchInput.value = ''; syncClearBtn(); }
            setDropdownVisible(false);
            return;
        }

        const math = evaluateMath(query);
        if (math && omniActiveIndex <= 0) {
            copyText(math.raw);
            SoundEngine.chime();
            renderDropdown();
            const sub = dropdown && dropdown.querySelector('.omni-item.is-math .omni-item-sub');
            if (sub) sub.textContent = '✓ 已复制到剪贴板';
            return;
        }

        SoundEngine.click(true);
        pushRecent(query);
        setDropdownVisible(false);
        window.open(searchEngines[currentEngine].url + encodeURIComponent(query), '_blank', 'noopener');
    }

    engineTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            SoundEngine.tick(1040, 0.016);
            selectEngine(tab.dataset.engine, true, true);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim() || recentSearches.length) {
                renderDropdown(false);
            }
        });
        searchInput.addEventListener('input', () => {
            syncClearBtn();
            omniActiveIndex = -1;
            renderDropdown(false);
        });
        searchInput.addEventListener('keydown', e => {
            if (e.isComposing || e.keyCode === 229) return;

            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                cycleEngine(e.key === 'ArrowUp' ? -1 : 1);
                return;
            }

            if (e.key === 'Escape') {
                if (dropdownOpen) {
                    e.preventDefault();
                    setDropdownVisible(false);
                }
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (dropdownOpen && omniItems.length > 0 && (searchInput.value.trim().startsWith('/') || omniActiveIndex >= 0 || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    if (e.key === 'ArrowDown') {
                        omniActiveIndex = (omniActiveIndex + 1) % omniItems.length;
                    } else {
                        omniActiveIndex = omniActiveIndex <= 0 ? omniItems.length - 1 : omniActiveIndex - 1;
                    }
                    renderDropdown(false);
                    return;
                }
                e.preventDefault();
                cycleEngine(e.key === 'ArrowUp' ? -1 : 1);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                if (dropdownOpen && omniActiveIndex >= 0 && omniItems[omniActiveIndex]) {
                    omniItems[omniActiveIndex].run(e);
                } else {
                    executeSearch();
                }
            }
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (!searchInput) return;
            searchInput.value = '';
            syncClearBtn();
            renderDropdown(false);
            searchInput.focus();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => executeSearch());
    }

    document.addEventListener('click', e => {
        if (omnibarWrap && !omnibarWrap.contains(e.target)) {
            setDropdownVisible(false);
        }
    });

    // 初始化默认引擎与水滴滑块（首次无拉伸动画）
    selectEngine(currentEngine, false, false);
    requestAnimationFrame(() => {
        const activeTab = engineTabs.find(t => t.dataset.engine === currentEngine);
        moveLiquidGlider(engineGlider, activeTab, false);
    });
    window.addEventListener('resize', () => {
        const activeTab = engineTabs.find(t => t.dataset.engine === currentEngine);
        moveLiquidGlider(engineGlider, activeTab, false);
    });

    // 全局快捷键：⌘K / Ctrl+K 唤起主搜索与命令列表，/ 聚焦搜索，⌥1/2/3 直达站点
    document.addEventListener('keydown', e => {
        if (e.isComposing || e.keyCode === 229) return;

        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            summonOmnibar(true);
            return;
        }

        if (e.key === '/' && !isEditableTarget(e.target)) {
            e.preventDefault();
            summonOmnibar(false);
            return;
        }

        if (e.altKey && !isEditableTarget(e.target)) {
            const portals = {
                '1': 'https://monki.de5.net',
                '2': 'https://pic.soomin.de5.net',
                '3': 'https://news.885123.xyz'
            };
            if (portals[e.key]) {
                e.preventDefault();
                SoundEngine.chime();
                window.open(portals[e.key], '_blank', 'noopener');
            }
        }
    });
}

// ==========================================================
// 5. 双模时钟（点击表盘切换机械滚轮 / DS-Digital LED）+ 交互太阳轨迹
// ==========================================================
function initChronoAndSolar() {
    const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const CLOCK_MODE_KEY = 'atelier_clock_mode';

    const clockCard = document.getElementById('clock-card');
    const clockDisplay = document.getElementById('clock-display');
    const clockLed = document.getElementById('clock');
    const reels = Array.from(document.querySelectorAll('#clock-reels .reel'));
    const greetingEl = document.getElementById('greeting');
    const ambientBg = document.getElementById('ambient-bg');

    const solarDial = document.getElementById('solar-dial');
    const solarFull = document.getElementById('solar-track-full');
    const solarDay = document.getElementById('solar-track-day');
    const solarOrb = document.getElementById('solar-orb');
    const solarGuide = document.getElementById('solar-guide');
    const solarPhase = document.getElementById('solar-phase-label');

    reels.forEach(reel => {
        const strip = reel.querySelector('.reel-strip');
        if (!strip) return;
        const frag = document.createDocumentFragment();
        for (let d = 0; d < 10; d++) {
            const span = document.createElement('span');
            span.textContent = String(d);
            frag.appendChild(span);
        }
        strip.replaceChildren(frag);
    });

    function setClockMode(mode) {
        if (!clockCard) return;
        const next = mode === 'led' ? 'led' : 'reel';
        clockCard.dataset.clockMode = next;
        writeStorage(CLOCK_MODE_KEY, next);
        if (clockDisplay) {
            clockDisplay.title = next === 'led'
                ? '当前：数码管（点击切回机械滚轮）'
                : '当前：机械滚轮（点击切换数码管）';
        }
    }

    function toggleClockMode() {
        SoundEngine.click(true);
        const curr = clockCard && clockCard.dataset.clockMode === 'led' ? 'led' : 'reel';
        setClockMode(curr === 'led' ? 'reel' : 'led');
    }

    if (clockDisplay) {
        clockDisplay.addEventListener('click', toggleClockMode);
        clockDisplay.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleClockMode();
            }
        });
    }
    setClockMode(readStorage(CLOCK_MODE_KEY, 'reel'));

    function solarPoint(t) {
        const clamped = Math.max(0, Math.min(1, t));
        const x = 16 + clamped * 248;
        const s = Math.sin((clamped - 0.25) * 2 * Math.PI);
        const y = s >= 0 ? 64 - s * 46 : 64 - s * 18;
        return { x, y, isDay: s >= 0 };
    }

    function describeSolarPhase(minutes, isPreview) {
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        let phase = '深夜静谧';
        if (h >= 5 && h < 8) phase = '破晓微光';
        else if (h >= 8 && h < 11) phase = '上午晴朗';
        else if (h >= 11 && h < 14) phase = '正午日盛';
        else if (h >= 14 && h < 17) phase = '午后时光';
        else if (h >= 17 && h < 20) phase = '暮色黄昏';
        else if (h >= 20 && h < 23) phase = '入夜星辰';
        return isPreview ? `预览 ${hhmm} · ${phase}` : `${phase} · ${hhmm}`;
    }

    function buildSolarCurves() {
        if (!solarFull || !solarDay) return;
        const fullPts = [];
        const dayPts = [];
        for (let i = 0; i <= 96; i++) {
            const t = i / 96;
            const pt = solarPoint(t);
            fullPts.push(`${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
            if (t >= 0.25 && t <= 0.75) {
                dayPts.push(`${dayPts.length === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
            }
        }
        solarFull.setAttribute('d', fullPts.join(' '));
        solarDay.setAttribute('d', dayPts.join(' '));
    }

    function positionSolarOrb(t, isPreview = false) {
        if (!solarOrb) return;
        const pt = solarPoint(t);
        solarOrb.setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        solarOrb.classList.toggle('is-night', !pt.isDay);

        const mins = Math.round(t * 1440) % 1440;
        if (solarPhase) solarPhase.textContent = describeSolarPhase(mins, isPreview);

        const dayPct = document.getElementById('day-pct');
        const dayFill = document.getElementById('day-meter-fill');
        const pctText = `${Math.floor(t * 100)}%`;
        if (dayPct) dayPct.textContent = `${isPreview ? '预览' : '今日'} ${pctText}`;
        if (dayFill) dayFill.style.width = `${(t * 100).toFixed(1)}%`;

        if (solarGuide) {
            if (isPreview) {
                solarGuide.setAttribute('x1', pt.x.toFixed(1));
                solarGuide.setAttribute('x2', pt.x.toFixed(1));
                solarGuide.setAttribute('opacity', '1');
            } else {
                solarGuide.setAttribute('opacity', '0');
            }
        }
    }

    buildSolarCurves();

    let isScrubbingSolar = false;
    let lastReadoutMinute = '';

    function updateReadout(now) {
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();
        const minuteKey = `${y}-${m}-${d} ${now.getHours()}:${now.getMinutes()}`;
        if (minuteKey === lastReadoutMinute) return;
        lastReadoutMinute = minuteKey;

        const pad = n => String(n).padStart(2, '0');
        const dateEl = document.getElementById('readout-date');
        if (dateEl) {
            dateEl.textContent = `${y}.${pad(m + 1)}.${pad(d)}`;
            dateEl.dateTime = `${y}-${pad(m + 1)}-${pad(d)}`;
        }
        const weekEl = document.getElementById('readout-week');
        if (weekEl) weekEl.textContent = WEEKDAYS[now.getDay()];

        const startOfYear = new Date(y, 0, 1);
        const yearProgress = (now - startOfYear) / (new Date(y + 1, 0, 1) - startOfYear);
        const dayOfYear = Math.round((new Date(y, m, d) - startOfYear) / 86400000) + 1;
        const yearDayEl = document.getElementById('year-day');
        const yearPctEl = document.getElementById('year-pct');
        if (yearDayEl) yearDayEl.textContent = String(dayOfYear);
        if (yearPctEl) yearPctEl.textContent = `${Math.floor(yearProgress * 100)}%`;

        if (!isScrubbingSolar) {
            positionSolarOrb((now.getHours() * 60 + now.getMinutes()) / 1440, false);
        }
    }

    function updateClock() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const hStr = pad(now.getHours());
        const mStr = pad(now.getMinutes());
        const sStr = pad(now.getSeconds());
        const digits = `${hStr}${mStr}${sStr}`;

        if (clockLed) clockLed.textContent = `${hStr}:${mStr}:${sStr}`;
        reels.forEach((reel, idx) => {
            const strip = reel.querySelector('.reel-strip');
            if (strip) strip.style.setProperty('--digit', digits[idx]);
        });

        const hour = now.getHours();
        let greeting = '你好';
        let phase = 'day';
        if (hour < 5) {
            greeting = '夜深了，注意休息';
            phase = 'night';
        } else if (hour < 9) {
            greeting = '新的一天，早上好！';
            phase = 'dawn';
        } else if (hour < 11) {
            greeting = '上午好，保持专注';
            phase = 'day';
        } else if (hour < 13) {
            greeting = '中午好，记得吃饭';
            phase = 'day';
        } else if (hour < 18) {
            greeting = '下午好，喝杯茶提提神';
            phase = hour >= 17 ? 'dusk' : 'day';
        } else if (hour < 23) {
            greeting = '晚上好，享受属于你的时间';
            phase = hour < 20 ? 'dusk' : 'night';
        } else {
            greeting = '夜深了，晚安';
            phase = 'night';
        }

        if (greetingEl) greetingEl.textContent = greeting;
        if (ambientBg) ambientBg.dataset.dayphase = phase;

        updateReadout(now);
    }

    if (solarDial) {
        solarDial.addEventListener('pointermove', e => {
            isScrubbingSolar = true;
            const rect = solarDial.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * 280;
            const t = Math.max(0, Math.min(1, (svgX - 16) / 248));
            positionSolarOrb(t, true);
        });
        solarDial.addEventListener('pointerleave', () => {
            isScrubbingSolar = false;
            const now = new Date();
            positionSolarOrb((now.getHours() * 60 + now.getMinutes()) / 1440, false);
        });
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// ==========================================================
// 6. 一言 API（悬停显隐刷新与复制按钮）
// ==========================================================
function initHitokoto() {
    const quoteEl = document.getElementById('hitokoto_text');
    const refreshBtn = document.getElementById('quote-refresh');
    const copyBtn = document.getElementById('quote-copy');
    if (!quoteEl) return;

    let lastFetch = 0;
    let copyTimer = null;

    function loadQuote(animate = false) {
        const now = Date.now();
        if (animate && now - lastFetch < 600) return;
        lastFetch = now;
        if (refreshBtn && animate) refreshBtn.classList.add('is-spinning');
        if (animate && !reducedMotion.matches) quoteEl.classList.add('is-swapping');

        fetchJsonWithRetry('https://v1.hitokoto.cn/?c=a&c=b', {}, { timeout: 3500, retries: 1, retryDelay: 250 })
            .then(data => {
                quoteEl.textContent = `${data.hitokoto} —— ${data.from}`;
            })
            .catch(() => {
                quoteEl.textContent = '生活明朗，万物可爱。';
            })
            .finally(() => {
                quoteEl.classList.remove('is-swapping');
                if (refreshBtn) refreshBtn.classList.remove('is-spinning');
            });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            SoundEngine.click(true);
            loadQuote(true);
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            copyText(quoteEl.textContent || '');
            SoundEngine.chime();
            const icon = copyBtn.querySelector('svg');
            copyBtn.classList.add('is-done');
            copyBtn.title = '已复制';
            setSvgIcon(icon, 'check');
            clearTimeout(copyTimer);
            copyTimer = setTimeout(() => {
                copyBtn.classList.remove('is-done');
                copyBtn.title = '复制语录';
                setSvgIcon(icon, 'copy');
            }, 1600);
        });
    }

    deskActions.refreshQuote = () => loadQuote(true);
    loadQuote(false);
}

// ==========================================================
// 7. 天气（高德定位 -> 高德天气 -> 心知备用，支持点击刷新）
// ==========================================================
function initWeather() {
    const weatherBtn = document.getElementById('weather-btn');
    const statusText = document.getElementById('weather-status');
    if (!statusText) return;

    const amapConfig = {
        key: '02d4bd74cc1897fcb432cc2f77f15098',
        securityCode: 'fd70b506e58e5953e91efe72322b9aff',
        defaultCity: '320100'
    };

    const seniverseConfig = {
        key: 'SBhWcvdeh-GwBOsHR',
        location: 'ip'
    };

    let activeRun = 0;

    function fetchWeather(isManual = false) {
        const runId = ++activeRun;
        let resolved = false;
        let seniverseStarted = false;
        let amapTimer = null;

        if (weatherBtn) weatherBtn.classList.add('is-syncing');
        if (isManual) statusText.textContent = '正在刷新天气...';

        function finalize(text) {
            if (resolved || runId !== activeRun) return;
            resolved = true;
            clearTimeout(amapTimer);
            statusText.textContent = text;
            if (weatherBtn) weatherBtn.classList.remove('is-syncing');
        }

        function trySeniverse() {
            if (resolved || seniverseStarted || runId !== activeRun) return;
            seniverseStarted = true;
            clearTimeout(amapTimer);
            const url = `https://api.seniverse.com/v3/weather/now.json?key=${seniverseConfig.key}&location=${seniverseConfig.location}&language=zh-Hans&unit=c`;
            fetchJsonWithRetry(url, {}, { timeout: 4000, retries: 1, retryDelay: 300 })
                .then(data => {
                    if (data.results && data.results[0]) {
                        const res = data.results[0];
                        finalize(`${res.location.name} · ${res.now.text} · ${res.now.temperature}℃`);
                    } else {
                        finalize('天气暂不可用');
                    }
                })
                .catch(() => finalize('天气暂不可用'));
        }

        function runAmapLogic() {
            if (runId !== activeRun) return;
            if (typeof AMap === 'undefined' || typeof AMap.plugin !== 'function') {
                trySeniverse();
                return;
            }
            AMap.plugin(['AMap.Geolocation', 'AMap.Weather'], () => {
                const geolocation = new AMap.Geolocation({ enableHighAccuracy: false, timeout: 3000 });
                const weather = new AMap.Weather();
                geolocation.getCityInfo((status, result) => {
                    const targetAdcode = status === 'complete' && result.adcode ? result.adcode : amapConfig.defaultCity;
                    weather.getLive(targetAdcode, (err, data) => {
                        if (!err && data && data.info === 'OK') {
                            finalize(`${data.city} · ${data.weather} · ${data.temperature}℃`);
                        } else {
                            trySeniverse();
                        }
                    });
                });
            });
        }

        amapTimer = setTimeout(trySeniverse, 6000);
        window._AMapSecurityConfig = { securityJsCode: amapConfig.securityCode };

        if (typeof AMap === 'undefined') {
            const script = document.createElement('script');
            script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapConfig.key}`;
            script.onload = runAmapLogic;
            script.onerror = trySeniverse;
            document.head.appendChild(script);
        } else {
            runAmapLogic();
        }
    }

    if (weatherBtn) {
        weatherBtn.addEventListener('click', () => {
            SoundEngine.click(true);
            fetchWeather(true);
        });
    }

    fetchWeather(false);
}

// ==========================================================
// 8. GitHub Star 数 & 3 个快捷入口实时连通性探测
// ==========================================================
function fetchGithubStars() {
    const starCountElem = document.getElementById('github-star-count');
    if (!starCountElem) return;
    starCountElem.textContent = 'SYNC';
    const CACHE_KEY = 'gh_stars_cache';
    const CACHE_TIME = 3600000;

    const cached = readStorage(CACHE_KEY, '');
    if (cached) {
        try {
            const { stars, time } = JSON.parse(cached);
            if (Date.now() - time < CACHE_TIME) {
                starCountElem.textContent = String(stars);
                return;
            }
        } catch {
            try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        }
    }

    fetchWithTimeout('https://api.github.com/repos/loong2004/my-nav-page', {}, 4500)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP_${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.stargazers_count !== undefined) {
                starCountElem.textContent = String(data.stargazers_count);
                writeStorage(CACHE_KEY, JSON.stringify({ stars: data.stargazers_count, time: Date.now() }));
            } else {
                starCountElem.textContent = 'OFF';
            }
        })
        .catch(() => {
            starCountElem.textContent = 'OFF';
        });
}

function initPortalPings() {
    const cards = Array.from(document.querySelectorAll('.portal-card[data-portal-url]'));
    if (!cards.length) return;

    function probeAll() {
        cards.forEach(card => {
            const url = card.dataset.portalUrl;
            const pill = card.querySelector('.portal-ping');
            const text = pill && pill.querySelector('.ping-text');
            if (!url || !pill || !text) return;

            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 4500);
            const t0 = performance.now();

            fetch(`${url}/?ping=${Date.now()}`, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                referrerPolicy: 'no-referrer',
                signal: ctrl.signal
            })
                .then(() => {
                    const ms = Math.round(performance.now() - t0);
                    pill.dataset.pingStatus = ms > 500 ? 'warn' : 'ok';
                    text.textContent = `${ms}ms`;
                })
                .catch(() => {
                    pill.dataset.pingStatus = 'warn';
                    text.textContent = '直达';
                })
                .finally(() => clearTimeout(timer));
        });
    }

    deskActions.rescanPortals = probeAll;
    probeAll();
}

// ==========================================================
// 9. 黑胶唱机播放器（带专辑弥散光背衬）+ 悬浮迷你音乐岛
// ==========================================================
function initNeonPlayer() {
    const root = document.getElementById('neon-player');
    if (!root || !root.dataset.id) return;

    const config = {
        api: root.dataset.api || 'https://api.injahow.cn/meting/',
        server: root.dataset.server || 'netease',
        type: root.dataset.type || 'playlist',
        id: root.dataset.id
    };

    const RING_CIRCUMFERENCE = 2 * Math.PI * 63;
    const MAX_ERROR_STREAK = 5;
    const PREFS_KEY = 'neon_player_prefs';

    root.innerHTML = `
        <img class="np-aura" src="./avatar.jpg" alt="" aria-hidden="true">

        <div class="np-head">
            <span class="np-kicker">
                <span class="np-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                <span class="np-status">LOADING</span>
            </span>
            <span class="np-index">---/---</span>
            <div class="np-head-actions">
                <button class="np-btn np-shuffle" type="button" aria-label="随机播放" title="随机播放" aria-pressed="true">${svgIcon('shuffle')}</button>
                <button class="np-btn np-list-toggle" type="button" aria-label="歌单" title="歌单" aria-expanded="false">${svgIcon('list')}</button>
            </div>
        </div>

        <div class="np-stage">
            <div class="np-platter-bay">
                <button class="np-disc" type="button" aria-label="播放或暂停">
                    <svg class="np-ring" viewBox="0 0 132 132" aria-hidden="true">
                        <circle class="np-ring-track" cx="66" cy="66" r="63"></circle>
                        <circle class="np-ring-progress" cx="66" cy="66" r="63"></circle>
                    </svg>
                    <span class="np-vinyl"><img class="np-cover" src="./avatar.jpg" alt="" decoding="async"></span>
                    <span class="np-disc-overlay" aria-hidden="true">${svgIcon('play')}</span>
                </button>
                <svg class="np-tonearm" viewBox="0 0 56 118" aria-hidden="true">
                    <circle class="arm-base" cx="42" cy="16" r="10"></circle>
                    <circle class="arm-pivot" cx="42" cy="16" r="3.5"></circle>
                    <path class="arm-rod" d="M 42 16 L 42 56 Q 42 74 36 92"></path>
                    <rect class="arm-head" x="32.5" y="90" width="7" height="11" rx="2" transform="rotate(8 36 95)"></rect>
                    <circle class="arm-tip" cx="36" cy="98" r="1.8"></circle>
                </svg>
            </div>

            <div class="np-meta">
                <div class="np-title"><span class="np-title-text">黑胶唱机</span></div>
                <div class="np-artist">—</div>
                <div class="np-lyrics-stage" aria-live="polite">
                    <button type="button" class="np-lyric-line np-lyric-prev">· · ·</button>
                    <div class="np-lyric-line np-lyric-curr">正在接入音乐频道...</div>
                    <button type="button" class="np-lyric-line np-lyric-next">· · ·</button>
                </div>
            </div>
        </div>

        <div class="np-foot">
            <div class="np-bar" role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="np-buffer"></span>
                <span class="np-played"></span>
                <span class="np-bar-tooltip">00:00</span>
            </div>
            <div class="np-controls">
                <span class="np-time"><span class="np-current">00:00</span><span class="np-total"> / --:--</span></span>
                <div class="np-buttons">
                    <button class="np-btn np-prev" type="button" aria-label="上一首" title="上一首">${svgIcon('prev')}</button>
                    <button class="np-btn np-play" type="button" aria-label="播放" title="播放">${svgIcon('play')}</button>
                    <button class="np-btn np-next" type="button" aria-label="下一首" title="下一首">${svgIcon('next')}</button>
                </div>
            </div>
        </div>

        <section class="np-drawer" aria-label="播放列表">
            <div class="np-drawer-head">
                ${svgIcon('search')}
                <input class="np-search" type="search" placeholder="过滤歌曲 / 歌手" autocomplete="off" spellcheck="false" aria-label="过滤播放列表">
                <span class="np-count">000</span>
                <button class="np-btn np-drawer-close" type="button" aria-label="关闭歌单" title="关闭歌单">${svgIcon('close')}</button>
            </div>
            <ol class="np-list"></ol>
        </section>
    `;

    const $ = sel => root.querySelector(sel);
    const els = {
        aura: $('.np-aura'),
        status: $('.np-status'),
        index: $('.np-index'),
        shuffle: $('.np-shuffle'),
        listToggle: $('.np-list-toggle'),
        drawerClose: $('.np-drawer-close'),
        disc: $('.np-disc'),
        ring: $('.np-ring-progress'),
        cover: $('.np-cover'),
        overlayIcon: $('.np-disc-overlay svg'),
        title: $('.np-title'),
        titleText: $('.np-title-text'),
        artist: $('.np-artist'),
        lyricPrev: $('.np-lyric-prev'),
        lyricCurr: $('.np-lyric-curr'),
        lyricNext: $('.np-lyric-next'),
        bar: $('.np-bar'),
        buffer: $('.np-buffer'),
        played: $('.np-played'),
        tooltip: $('.np-bar-tooltip'),
        current: $('.np-current'),
        total: $('.np-total'),
        prev: $('.np-prev'),
        play: $('.np-play'),
        playIcon: $('.np-play svg'),
        next: $('.np-next'),
        search: $('.np-search'),
        count: $('.np-count'),
        list: $('.np-list')
    };

    const island = {
        box: document.getElementById('music-island'),
        jump: document.getElementById('island-jump'),
        cover: document.getElementById('island-cover'),
        title: document.getElementById('island-title'),
        sub: document.getElementById('island-sub'),
        play: document.getElementById('island-play'),
        playIcon: document.querySelector('#island-play svg'),
        next: document.getElementById('island-next')
    };

    const audio = new Audio();
    audio.preload = 'none';

    let tracks = [];
    let index = -1;
    let playHistory = [];
    let lyrics = [];
    let lyricIndex = -2;
    let lyricToken = 0;
    let errorStreak = 0;
    let wantsPlay = false;
    let isSeeking = false;
    let seekRatio = 0;
    let deckVisible = true;
    let hasPlayedOnce = false;

    const prefs = (() => {
        try {
            return { shuffle: true, ...JSON.parse(readStorage(PREFS_KEY, '{}')) };
        } catch {
            return { shuffle: true };
        }
    })();

    function savePrefs() {
        writeStorage(PREFS_KEY, JSON.stringify({ shuffle: prefs.shuffle }));
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function pad3(n) {
        return String(n).padStart(3, '0');
    }

    function setStatus(text) {
        els.status.textContent = text;
    }

    function updateTonearm(playing, ratio) {
        const deg = playing ? 10 + Math.min(Math.max(ratio, 0), 1) * 12 : -6;
        root.style.setProperty('--arm-deg', `${deg.toFixed(2)}deg`);
    }

    function syncIslandVisibility() {
        if (!island.box) return;
        const show = tracks.length > 0 && hasPlayedOnce && !deckVisible;
        island.box.classList.toggle('is-visible', show);
        island.box.setAttribute('aria-hidden', String(!show));
    }

    function setListOpen(open) {
        root.classList.toggle('is-list-open', open);
        els.listToggle.setAttribute('aria-expanded', String(open));
        els.listToggle.classList.toggle('is-on', open);
        if (open) requestAnimationFrame(scrollActiveIntoView);
    }

    function setShuffle(on) {
        prefs.shuffle = on;
        els.shuffle.classList.toggle('is-on', on);
        els.shuffle.setAttribute('aria-pressed', String(on));
        els.shuffle.title = on ? '随机播放：开' : '顺序播放';
        savePrefs();
    }

    function updateMarquee() {
        const text = els.titleText;
        text.classList.remove('is-scrolling');
        els.title.classList.remove('has-overflow');
        const overflow = text.scrollWidth - els.title.clientWidth;
        if (overflow > 4) {
            text.style.setProperty('--np-shift', `${-overflow - 16}px`);
            text.style.setProperty('--np-marquee-duration', `${Math.max(5, overflow / 22)}s`);
            els.title.classList.add('has-overflow');
            text.classList.add('is-scrolling');
        }
    }

    function parseLrc(text) {
        const result = [];
        text.split(/\r?\n/).forEach(line => {
            const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
            if (!stamps.length) return;
            const content = line.replace(/\[[^\]]*\]/g, '').trim();
            if (!content) return;
            stamps.forEach(m => {
                result.push({ t: Number(m[1]) * 60 + parseFloat(m[2].replace(':', '.')), text: content });
            });
        });
        return result.sort((a, b) => a.t - b.t);
    }

    function setLyricDisplay(prevObj, currText, nextObj, animate) {
        els.lyricPrev.textContent = prevObj ? prevObj.text : '· · ·';
        if (prevObj) els.lyricPrev.dataset.time = String(prevObj.t);
        else delete els.lyricPrev.dataset.time;

        if (els.lyricCurr.textContent !== currText) {
            els.lyricCurr.textContent = currText;
            if (animate) replayAnimation(els.lyricCurr, 'is-entering');
        }

        els.lyricNext.textContent = nextObj ? nextObj.text : '· · ·';
        if (nextObj) els.lyricNext.dataset.time = String(nextObj.t);
        else delete els.lyricNext.dataset.time;

        if (island.sub && tracks[index]) {
            island.sub.textContent = lyrics.length && currText !== '· · ·' ? currText : tracks[index].artist;
        }
    }

    function findLyricIndex(time) {
        let lo = 0;
        let hi = lyrics.length - 1;
        let found = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (lyrics[mid].t <= time + 0.2) {
                found = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return found;
    }

    function syncLyric(time) {
        if (!lyrics.length) return;
        const i = findLyricIndex(time);
        if (i === lyricIndex) return;
        lyricIndex = i;
        const prev = i > 0 ? lyrics[i - 1] : null;
        const curr = i >= 0 ? lyrics[i].text : '· · ·';
        const next = i + 1 < lyrics.length ? lyrics[i + 1] : null;
        setLyricDisplay(prev, curr, next, true);
    }

    function loadLyrics(track) {
        const token = ++lyricToken;
        lyrics = [];
        lyricIndex = -2;
        setLyricDisplay(null, '歌词加载中...', null, false);
        if (!track.lrc) {
            setLyricDisplay(null, '暂无歌词，请欣赏', null, false);
            return;
        }

        fetchWithTimeout(track.lrc, {}, 6000)
            .then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP_${res.status}`))))
            .then(text => {
                if (token !== lyricToken) return;
                lyrics = parseLrc(text);
                if (!lyrics.length) {
                    setLyricDisplay(null, text.includes('纯音乐') ? '纯音乐，请欣赏' : '暂无歌词，请欣赏', null, false);
                    return;
                }
                if (!audio.paused || audio.currentTime > 0) syncLyric(audio.currentTime);
                else setLyricDisplay(null, '轻触唱盘，开始今天配乐', lyrics[0] || null, false);
            })
            .catch(() => {
                if (token === lyricToken) setLyricDisplay(null, '歌词暂时无法获取', null, false);
            });
    }

    function renderProgress(ratio) {
        const clamped = Math.min(Math.max(ratio, 0), 1);
        els.played.style.width = `${clamped * 100}%`;
        els.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - clamped));
        els.bar.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
        if (!audio.paused) updateTonearm(true, clamped);
    }

    function renderBuffer() {
        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0 || !audio.buffered.length) {
            els.buffer.style.width = '0%';
            return;
        }
        const end = audio.buffered.end(audio.buffered.length - 1);
        els.buffer.style.width = `${Math.min(end / duration, 1) * 100}%`;
    }

    function ratioFromPointer(e) {
        const rect = els.bar.getBoundingClientRect();
        return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    }

    function canSeek() {
        return Number.isFinite(audio.duration) && audio.duration > 0;
    }

    function renderList() {
        const fragment = document.createDocumentFragment();
        tracks.forEach((track, i) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'np-item';
            btn.dataset.index = String(i);

            const no = document.createElement('span');
            no.className = 'np-item-no';
            no.textContent = pad3(i + 1);

            const meta = document.createElement('span');
            meta.className = 'np-item-meta';
            const name = document.createElement('span');
            name.className = 'np-item-name';
            name.textContent = track.name;
            const artist = document.createElement('span');
            artist.className = 'np-item-artist';
            artist.textContent = track.artist;
            meta.append(name, artist);

            btn.append(no, meta);
            li.appendChild(btn);
            li.dataset.search = `${track.name} ${track.artist}`.toLowerCase();
            fragment.appendChild(li);
        });
        els.list.replaceChildren(fragment);
        els.count.textContent = `${tracks.length} 首`;
    }

    function markActive() {
        const old = els.list.querySelector('.np-item.is-active');
        if (old) old.classList.remove('is-active');
        const btn = els.list.querySelector(`.np-item[data-index="${index}"]`);
        if (btn) btn.classList.add('is-active');
        if (root.classList.contains('is-list-open')) scrollActiveIntoView();
    }

    function scrollActiveIntoView() {
        const btn = els.list.querySelector('.np-item.is-active');
        if (!btn || btn.parentElement.hidden) return;
        const li = btn.parentElement;
        els.list.scrollTop = li.offsetTop - els.list.clientHeight / 2 + li.offsetHeight / 2;
    }

    function filterList() {
        const query = els.search.value.trim().toLowerCase();
        let visible = 0;
        els.list.querySelectorAll('li').forEach(li => {
            const match = !query || li.dataset.search.includes(query);
            li.hidden = !match;
            if (match) visible++;
        });
        els.count.textContent = query ? `${visible}/${tracks.length}` : `${tracks.length} 首`;
        if (query) els.list.scrollTop = 0;
        else scrollActiveIntoView();
    }

    function updateMediaSession(track) {
        if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            album: 'Loong\'s Desk',
            artwork: track.pic ? [{ src: track.pic, sizes: '300x300' }] : []
        });
    }

    function loadTrack(i, autoplay) {
        if (!tracks.length) return;
        index = (i + tracks.length) % tracks.length;
        const track = tracks[index];

        audio.src = track.url;
        const coverSrc = track.pic || './avatar.jpg';
        els.cover.src = coverSrc;
        if (els.aura) els.aura.src = coverSrc;
        if (island.cover) island.cover.src = coverSrc;

        els.titleText.textContent = track.name;
        els.artist.textContent = track.artist;
        if (island.title) island.title.textContent = track.name;
        if (island.sub) island.sub.textContent = track.artist;

        els.index.textContent = `${pad3(index + 1)}/${pad3(tracks.length)}`;
        els.current.textContent = '00:00';
        els.total.textContent = ' / --:--';
        els.buffer.style.width = '0%';
        renderProgress(0);

        replayAnimation(els.title, 'is-switching');
        replayAnimation(els.artist, 'is-switching');
        updateMarquee();
        markActive();
        loadLyrics(track);
        if (!autoplay) setLyricDisplay(null, '轻触唱盘，开始今天配乐', null, false);
        updateMediaSession(track);

        if (autoplay) play();
    }

    function play() {
        if (!tracks.length) return;
        wantsPlay = true;
        if (!audio.src) loadTrack(index < 0 ? 0 : index, false);
        const promise = audio.play();
        if (promise && promise.catch) {
            promise.catch(err => {
                if (err.name === 'NotAllowedError') {
                    wantsPlay = false;
                    setStatus('TAP TO PLAY');
                }
            });
        }
    }

    function pause() {
        wantsPlay = false;
        audio.pause();
    }

    function togglePlay() {
        SoundEngine.click(audio.paused);
        if (audio.paused) play();
        else pause();
    }

    function pickNextIndex() {
        if (tracks.length < 2) return index;
        if (!prefs.shuffle) return index + 1;
        let n;
        do {
            n = Math.floor(Math.random() * tracks.length);
        } while (n === index);
        return n;
    }

    function next() {
        if (!tracks.length) return;
        SoundEngine.tick(1280, 0.018);
        playHistory.push(index);
        if (playHistory.length > 100) playHistory.shift();
        loadTrack(pickNextIndex(), true);
    }

    function prev() {
        if (!tracks.length) return;
        SoundEngine.tick(980, 0.018);
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        if (prefs.shuffle && playHistory.length) {
            loadTrack(playHistory.pop(), true);
        } else {
            loadTrack(index - 1, true);
        }
    }

    function setPlayingUI(playing) {
        root.classList.toggle('is-playing', playing);
        if (island.box) island.box.classList.toggle('is-playing', playing);
        const icon = playing ? 'pause' : 'play';
        setSvgIcon(els.playIcon, icon);
        setSvgIcon(els.overlayIcon, icon);
        setSvgIcon(island.playIcon, icon);

        const label = playing ? '暂停' : '播放';
        els.play.setAttribute('aria-label', label);
        els.play.title = label;
        updateTonearm(playing, canSeek() ? audio.currentTime / audio.duration : 0);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
        }
    }

    audio.addEventListener('play', () => {
        hasPlayedOnce = true;
        setPlayingUI(true);
        syncIslandVisibility();
    });
    audio.addEventListener('pause', () => {
        setPlayingUI(false);
        if (tracks.length && !audio.ended) setStatus('STANDBY');
    });
    audio.addEventListener('playing', () => {
        errorStreak = 0;
        setStatus('NOW PLAYING');
        lyricIndex = -2;
        if (lyrics.length) syncLyric(audio.currentTime);
    });
    audio.addEventListener('waiting', () => {
        if (wantsPlay) setStatus('BUFFERING');
    });
    audio.addEventListener('ended', next);
    audio.addEventListener('progress', renderBuffer);
    audio.addEventListener('durationchange', () => {
        els.total.textContent = ` / ${formatTime(audio.duration)}`;
    });
    audio.addEventListener('timeupdate', () => {
        if (isSeeking) return;
        els.current.textContent = formatTime(audio.currentTime);
        renderProgress(canSeek() ? audio.currentTime / audio.duration : 0);
        syncLyric(audio.currentTime);
    });
    audio.addEventListener('error', () => {
        if (!audio.getAttribute('src') || !tracks.length) return;
        const btn = els.list.querySelector(`.np-item[data-index="${index}"]`);
        if (btn) btn.classList.add('is-broken');
        if (!wantsPlay) return;

        errorStreak++;
        if (errorStreak >= MAX_ERROR_STREAK) {
            wantsPlay = false;
            setPlayingUI(false);
            setStatus('SIGNAL LOST');
            setLyricDisplay(null, '连续多首无法播放，请稍后再试', null, true);
            return;
        }
        setStatus('SKIPPING');
        setLyricDisplay(null, '这首暂时无法播放，自动跳过...', null, true);
        setTimeout(() => {
            if (wantsPlay) next();
        }, 800);
    });

    els.disc.addEventListener('click', togglePlay);
    els.play.addEventListener('click', togglePlay);
    els.next.addEventListener('click', next);
    els.prev.addEventListener('click', prev);
    els.shuffle.addEventListener('click', () => {
        SoundEngine.click(true);
        setShuffle(!prefs.shuffle);
    });
    els.listToggle.addEventListener('click', () => {
        SoundEngine.click(true);
        setListOpen(!root.classList.contains('is-list-open'));
    });
    els.drawerClose.addEventListener('click', () => setListOpen(false));

    [els.lyricPrev, els.lyricNext].forEach(btn => {
        btn.addEventListener('click', () => {
            const t = parseFloat(btn.dataset.time);
            if (!Number.isFinite(t)) return;
            SoundEngine.tick(1320, 0.016);
            audio.currentTime = Math.max(0, t);
            if (audio.paused) play();
        });
    });

    els.list.addEventListener('click', e => {
        const btn = e.target.closest('.np-item');
        if (!btn) return;
        const i = Number(btn.dataset.index);
        if (i === index) {
            togglePlay();
            return;
        }
        playHistory.push(index);
        loadTrack(i, true);
    });

    els.search.addEventListener('input', filterList);

    function updateBarTooltip(e) {
        if (!els.tooltip) return;
        const r = ratioFromPointer(e);
        els.tooltip.style.left = `${(r * 100).toFixed(1)}%`;
        els.tooltip.textContent = canSeek() ? formatTime(r * audio.duration) : '00:00';
        els.tooltip.classList.add('is-visible');
    }

    els.bar.addEventListener('pointerenter', updateBarTooltip);
    els.bar.addEventListener('pointermove', e => {
        updateBarTooltip(e);
        if (!isSeeking) return;
        seekRatio = ratioFromPointer(e);
        renderProgress(seekRatio);
        els.current.textContent = formatTime(seekRatio * audio.duration);
    });
    els.bar.addEventListener('pointerleave', () => {
        if (!isSeeking && els.tooltip) els.tooltip.classList.remove('is-visible');
    });
    els.bar.addEventListener('pointerdown', e => {
        if (!canSeek()) return;
        isSeeking = true;
        els.bar.classList.add('is-seeking');
        els.bar.setPointerCapture(e.pointerId);
        seekRatio = ratioFromPointer(e);
        renderProgress(seekRatio);
        updateBarTooltip(e);
        els.current.textContent = formatTime(seekRatio * audio.duration);
    });
    function endSeek() {
        if (!isSeeking) return;
        isSeeking = false;
        els.bar.classList.remove('is-seeking');
        if (els.tooltip) els.tooltip.classList.remove('is-visible');
        if (canSeek()) audio.currentTime = seekRatio * audio.duration;
    }
    els.bar.addEventListener('pointerup', endSeek);
    els.bar.addEventListener('pointercancel', endSeek);
    els.bar.addEventListener('keydown', e => {
        if (!canSeek()) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const delta = e.key === 'ArrowLeft' ? -5 : 5;
            audio.currentTime = Math.min(Math.max(audio.currentTime + delta, 0), audio.duration);
        }
    });

    if (island.play) island.play.addEventListener('click', togglePlay);
    if (island.next) island.next.addEventListener('click', next);
    if (island.jump) {
        island.jump.addEventListener('click', () => {
            SoundEngine.click(true);
            root.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        });
    }

    if ('IntersectionObserver' in window && island.box) {
        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                deckVisible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
                syncIslandVisibility();
            },
            { threshold: [0, 0.15, 0.5] }
        );
        observer.observe(root);
    }

    document.addEventListener('click', e => {
        if (root.classList.contains('is-list-open') && !root.contains(e.target)) setListOpen(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && root.classList.contains('is-list-open')) {
            setListOpen(false);
            els.listToggle.focus();
        }
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateMarquee, 150);
    });

    els.cover.addEventListener('error', () => {
        if (!els.cover.src.endsWith('avatar.jpg')) els.cover.src = './avatar.jpg';
        if (els.aura && !els.aura.src.endsWith('avatar.jpg')) els.aura.src = './avatar.jpg';
        if (island.cover && !island.cover.src.endsWith('avatar.jpg')) island.cover.src = './avatar.jpg';
    });

    if ('mediaSession' in navigator) {
        const handlers = { play, pause, previoustrack: prev, nexttrack: next };
        Object.entries(handlers).forEach(([action, handler]) => {
            try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* ignore */ }
        });
    }

    deskActions.togglePlay = togglePlay;
    deskActions.nextTrack = next;

    els.ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    renderProgress(0);
    updateTonearm(false, 0);
    setShuffle(prefs.shuffle !== false);

    const playlistUrl = `${config.api}?server=${encodeURIComponent(config.server)}&type=${encodeURIComponent(config.type)}&id=${encodeURIComponent(config.id)}`;

    fetchJsonWithRetry(playlistUrl, {}, { timeout: 8000, retries: 2, retryDelay: 600 })
        .then(data => {
            tracks = (Array.isArray(data) ? data : [])
                .filter(item => item && item.url)
                .map(item => ({
                    name: item.name || '未知曲目',
                    artist: item.artist || '未知歌手',
                    url: item.url,
                    pic: item.pic || '',
                    lrc: item.lrc || ''
                }));
            if (!tracks.length) throw new Error('EMPTY_PLAYLIST');

            root.classList.add('is-ready');
            renderList();
            loadTrack(prefs.shuffle ? Math.floor(Math.random() * tracks.length) : 0, false);
            setStatus('STANDBY');
            syncIslandVisibility();
        })
        .catch(() => {
            root.classList.add('is-offline');
            setStatus('OFFLINE');
            els.titleText.textContent = 'NO SIGNAL';
            els.artist.textContent = '音乐频道暂时无法连接';
            setLyricDisplay(null, '歌单加载失败，请稍后刷新重试', null, false);
        });
}

// ==========================================================
// 10. GitHub 提交矩阵（2D Dock 放大镜 + 悬浮提示 + 强度筛选）
// ==========================================================
function initContributions() {
    const box = document.getElementById('contrib');
    const grid = document.getElementById('contrib-grid');
    const total = document.getElementById('contrib-total');
    const tooltip = document.getElementById('contrib-tooltip');
    if (!box || !grid || !total || !box.dataset.user) return;

    const user = box.dataset.user;
    const CACHE_KEY = `contrib_cache_${user}`;
    const CACHE_TIME = 6 * 3600000;
    const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    let rendered = false;
    let totalCols = 0;
    let cellGrid = [];
    const activeBoosted = new Set();
    let lastHoverKey = '';

    function computeMaxStreak(days) {
        let maxStreak = 0;
        let curStreak = 0;
        days.forEach(d => {
            if (Number(d.count) > 0) {
                curStreak++;
                if (curStreak > maxStreak) maxStreak = curStreak;
            } else {
                curStreak = 0;
            }
        });
        return maxStreak;
    }

    function render(data) {
        const days = Array.isArray(data && data.contributions) ? data.contributions : [];
        if (!days.length) throw new Error('EMPTY');

        const fragment = document.createDocumentFragment();
        const firstWeekday = new Date(`${days[0].date}T00:00:00`).getDay();
        const totalSlots = firstWeekday + days.length;
        totalCols = Math.ceil(totalSlots / 7);
        cellGrid = Array.from({ length: totalCols }, () => new Array(7).fill(null));

        for (let i = 0; i < firstWeekday; i++) {
            const pad = document.createElement('i');
            pad.className = 'is-pad';
            fragment.appendChild(pad);
        }

        days.forEach((day, index) => {
            const slot = firstWeekday + index;
            const col = Math.floor(slot / 7);
            const row = slot % 7;
            const level = Math.min(Math.max(Number(day.level) || 0, 0), 4);

            const dot = document.createElement('i');
            dot.dataset.col = String(col);
            dot.dataset.row = String(row);
            dot.dataset.l = String(level);
            dot.dataset.date = day.date;
            dot.dataset.count = String(day.count || 0);
            fragment.appendChild(dot);
            cellGrid[col][row] = dot;
        });

        grid.replaceChildren(fragment);

        const sum = data.total && typeof data.total === 'object'
            ? Object.values(data.total).reduce((acc, n) => acc + (Number(n) || 0), 0)
            : days.reduce((acc, day) => acc + (day.count || 0), 0);
        const maxStreak = computeMaxStreak(days);
        total.innerHTML = `过去一年 <strong>${sum}</strong> 次提交 · 最长连续 <strong>${maxStreak}</strong> 天`;

        const scroller = grid.parentElement;
        scroller.scrollLeft = scroller.scrollWidth;
        rendered = true;
    }

    function clearMagnify() {
        activeBoosted.forEach(cell => {
            cell.style.transform = '';
            cell.style.zIndex = '';
        });
        activeBoosted.clear();
        lastHoverKey = '';
        if (tooltip) tooltip.classList.remove('is-visible');
    }

    grid.addEventListener('pointermove', e => {
        if (!totalCols || !hoverCapable.matches) return;
        const gridRect = grid.getBoundingClientRect();
        const colFloat = ((e.clientX - gridRect.left) / gridRect.width) * totalCols;
        const rowFloat = ((e.clientY - gridRect.top) / gridRect.height) * 7;
        const col = Math.max(0, Math.min(totalCols - 1, Math.floor(colFloat)));
        const row = Math.max(0, Math.min(6, Math.floor(rowFloat)));

        const nextBoosted = new Set();
        if (!reducedMotion.matches) {
            for (let c = Math.max(0, col - 2); c <= Math.min(totalCols - 1, col + 2); c++) {
                for (let r = Math.max(0, row - 2); r <= Math.min(6, row + 2); r++) {
                    const cell = cellGrid[c] && cellGrid[c][r];
                    if (!cell) continue;
                    const dist = Math.hypot(c - colFloat + 0.5, r - rowFloat + 0.5);
                    if (dist < 2.6) {
                        const scale = 1 + 0.52 * Math.cos((dist / 2.6) * (Math.PI / 2));
                        cell.style.transform = `scale(${scale.toFixed(3)})`;
                        cell.style.zIndex = String(Math.round(10 - dist * 3));
                        nextBoosted.add(cell);
                    }
                }
            }
        }

        activeBoosted.forEach(cell => {
            if (!nextBoosted.has(cell)) {
                cell.style.transform = '';
                cell.style.zIndex = '';
            }
        });
        activeBoosted.clear();
        nextBoosted.forEach(c => activeBoosted.add(c));

        const hovered = cellGrid[col] && cellGrid[col][row];
        if (hovered && tooltip) {
            const key = `${col}:${row}`;
            if (key !== lastHoverKey) {
                lastHoverKey = key;
                const lv = Number(hovered.dataset.l) || 0;
                SoundEngine.tick(960 + lv * 130, 0.014);
            }
            const stageRect = box.querySelector('.contrib-stage').getBoundingClientRect();
            const relX = Math.max(88, Math.min(stageRect.width - 88, e.clientX - stageRect.left));
            const dt = new Date(`${hovered.dataset.date}T00:00:00`);
            const wd = Number.isNaN(dt.getTime()) ? '' : ` ${WEEKDAYS[dt.getDay()]}`;
            tooltip.textContent = `${hovered.dataset.date}${wd} · ${hovered.dataset.count} 次提交`;
            tooltip.style.left = `${relX.toFixed(1)}px`;
            tooltip.classList.add('is-visible');
        }
    });

    grid.addEventListener('pointerleave', clearMagnify);

    const swatches = Array.from(box.querySelectorAll('.legend-swatch'));
    swatches.forEach(btn => {
        btn.addEventListener('click', () => {
            SoundEngine.click(true);
            const level = btn.dataset.filter;
            const isSame = box.dataset.filterLevel === level;
            if (isSame) {
                delete box.dataset.filterLevel;
                swatches.forEach(s => s.setAttribute('aria-pressed', 'false'));
            } else {
                box.dataset.filterLevel = level;
                swatches.forEach(s => s.setAttribute('aria-pressed', String(s === btn)));
            }
        });
    });

    try {
        const cached = JSON.parse(readStorage(CACHE_KEY, 'null'));
        if (cached && cached.data) {
            render(cached.data);
            if (Date.now() - cached.time < CACHE_TIME) return;
        }
    } catch {
        try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    }

    fetchJsonWithRetry(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`, {}, { timeout: 8000, retries: 1, retryDelay: 500 })
        .then(data => {
            render(data);
            writeStorage(CACHE_KEY, JSON.stringify({ data, time: Date.now() }));
        })
        .catch(() => {
            if (rendered) return;
            box.classList.add('is-failed');
            total.innerHTML = `提交记录暂时读取失败，<a href="https://github.com/${encodeURIComponent(user)}" target="_blank" rel="noopener noreferrer">去 GitHub 查看</a>`;
        });
}

// ==========================================================
// 11. 网络状态监测（液态滑块筛选 + 面积火花线 + 单节点重测）
// ==========================================================
function startLatencyTest() {
    const LATENCY_CONFIG = {
        count: 16,
        probeTimeoutMs: 5000,
        refreshIntervalMs: 1236,
        waitVisiblePollMs: 300,
        chartMaxMs: 500
    };

    const LATENCY_SITES = [
        { name: 'Bilibili', region: '国内', icon: 'bilibili', url: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
        { name: '微信', region: '国内', icon: 'wechat', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
        { name: '淘宝', region: '国内', icon: 'bag', url: 'https://www.taobao.com/favicon.ico' },
        { name: '字节跳动', region: '国内', icon: 'tiktok', url: 'https://lf3-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico' },
        { name: 'GitHub', region: '国际', icon: 'github', url: 'https://github.githubassets.com/favicon.ico' },
        { name: 'jsDelivr', region: '国际', icon: 'cube', url: 'https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200' },
        { name: 'Cloudflare', region: '国际', icon: 'cloud', url: 'https://www.cloudflare.com/favicon.ico' },
        { name: 'YouTube', region: '国际', icon: 'youtube', url: 'https://www.youtube.com/favicon.ico' }
    ];

    const grid = document.getElementById('network-grid');
    const networkSection = document.getElementById('network-section');
    const networkToggle = document.getElementById('network-toggle');
    const networkSummary = document.getElementById('network-summary');
    const filterTabs = Array.from(document.querySelectorAll('.net-tab'));
    const netGlider = document.getElementById('net-glider');
    const rescanBtn = document.getElementById('net-rescan');

    if (!grid) return;

    const siteLatencies = {};
    let activeRegion = 'all';

    function getSiteId(site) {
        return site.name.toLowerCase().replace(/\s+/g, '-');
    }

    async function testLatency(site) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LATENCY_CONFIG.probeTimeoutMs);
        const start = performance.now();
        try {
            const sep = site.url.includes('?') ? '&' : '?';
            const probeUrl = `${site.url}${sep}t=${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
            await fetch(probeUrl, {
                method: 'HEAD',
                cache: 'no-store',
                mode: 'no-cors',
                referrerPolicy: 'no-referrer',
                signal: controller.signal
            });
            return Math.round(performance.now() - start);
        } catch {
            return -1;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function isLatencyPageVisible() {
        return !document.hidden && networkSection && !networkSection.classList.contains('is-collapsed');
    }

    function waitForVisiblePage() {
        if (isLatencyPageVisible()) return Promise.resolve();
        return new Promise(resolve => {
            const timer = setInterval(() => {
                if (isLatencyPageVisible()) {
                    clearInterval(timer);
                    resolve();
                }
            }, LATENCY_CONFIG.waitVisiblePollMs);
        });
    }

    function getLatencyColor(latency) {
        if (latency === -1 || latency >= 300) return { class: 'red', css: 'var(--status-red)' };
        if (latency >= 150) return { class: 'yellow', css: 'var(--status-yellow)' };
        return { class: 'green', css: 'var(--status-green)' };
    }

    function generateLatencyCards() {
        grid.innerHTML = LATENCY_SITES.map(site => {
            const id = getSiteId(site);
            return `
                <article class="net-card" data-site-id="${id}" data-region="${site.region}" title="点击立即重测 ${site.name}">
                    <div class="net-top">
                        <span class="net-name">${svgIcon(site.icon)}${site.name}</span>
                        <span class="net-badge">${site.region === '国内' ? 'CN' : 'INTL'}</span>
                    </div>
                    <div class="net-mid">
                        <span class="net-latency" id="latency-${id}">—</span>
                        <span class="net-meta" id="meta-${id}">等待探测</span>
                    </div>
                    <svg class="latency-chart" height="32" id="chart-${id}" aria-hidden="true">
                        <defs>
                            <linearGradient id="net-grad-${id}" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="var(--status-green)" stop-opacity="0.32"></stop>
                                <stop offset="100%" stop-color="var(--status-green)" stop-opacity="0"></stop>
                            </linearGradient>
                        </defs>
                        <path id="area-${id}" fill="url(#net-grad-${id})"></path>
                        <path id="path-${id}" fill="none" stroke="var(--text-3)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
                        <line class="net-guide" id="guide-${id}" x1="0" y1="0" x2="0" y2="32" opacity="0"></line>
                        <circle id="cursor-${id}" r="2.6" fill="var(--text)" opacity="0"></circle>
                    </svg>
                </article>
            `;
        }).join('');
    }

    function updateSummary() {
        if (!networkSummary) return;
        const visibleSites = LATENCY_SITES.filter(s => activeRegion === 'all' || s.region === activeRegion);
        const avgs = [];
        let online = 0;

        visibleSites.forEach(site => {
            const arr = (siteLatencies[getSiteId(site)] || []).filter(v => v !== -1);
            if (arr.length) {
                online++;
                avgs.push(arr.reduce((a, b) => a + b, 0) / arr.length);
            }
        });

        if (!avgs.length) {
            networkSummary.textContent = `${visibleSites.length} 个节点探测中`;
        } else {
            const overall = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
            networkSummary.textContent = `平均 ${overall}ms · ${online}/${visibleSites.length} 在线`;
        }
    }

    function updateLatencyDisplay(site) {
        const id = getSiteId(site);
        const latencies = siteLatencies[id] || [];
        if (!latencies.length) return;

        const textElem = document.getElementById(`latency-${id}`);
        const metaElem = document.getElementById(`meta-${id}`);
        const pathElem = document.getElementById(`path-${id}`);
        const areaElem = document.getElementById(`area-${id}`);
        const cursorElem = document.getElementById(`cursor-${id}`);
        const gradStop = document.querySelector(`#net-grad-${id} stop`);
        if (!textElem || !pathElem || !cursorElem) return;

        const valid = latencies.filter(l => l !== -1);
        const last = latencies[latencies.length - 1];

        let displayValue = '—';
        let metaText = '等待采样';
        let color = getLatencyColor(-1);

        if (valid.length === 0 && last === -1) {
            displayValue = 'TIMEOUT';
            metaText = '连接超时';
        } else if (valid.length > 0) {
            const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
            const min = Math.min(...valid);
            const jitter = Math.round(valid.reduce((a, b) => a + Math.abs(b - avg), 0) / valid.length);
            displayValue = `${Math.round(avg)}ms`;
            metaText = `min ${min} · ±${jitter}ms`;
            color = getLatencyColor(Math.round(avg));
        }

        textElem.textContent = displayValue;
        textElem.className = `net-latency text-${color.class}`;
        if (metaElem && !metaElem.dataset.inspecting) {
            metaElem.textContent = metaText;
        }
        if (metaElem) metaElem.dataset.defaultMeta = metaText;

        const chartWidth = pathElem.parentElement.clientWidth || 200;
        const chartHeight = 32;
        const points = latencies.slice(-LATENCY_CONFIG.count);
        if (points.length < 2) return;

        const xStep = chartWidth / (LATENCY_CONFIG.count - 1);
        let pathData = '';
        let prevX = 0;
        let prevY = 0;
        const coords = [];

        points.forEach((l, i) => {
            const x = i * xStep;
            const y = l === -1
                ? chartHeight
                : chartHeight - (Math.min(l, LATENCY_CONFIG.chartMaxMs) / LATENCY_CONFIG.chartMaxMs) * (chartHeight - 4) - 2;
            coords.push({ x, y, l });

            if (i === 0) {
                pathData = `M ${x} ${y}`;
            } else {
                const midX = (prevX + x) / 2;
                const midY = (prevY + y) / 2;
                pathData += ` Q ${prevX} ${prevY}, ${midX} ${midY}`;
                if (i === points.length - 1) {
                    pathData += ` T ${x} ${y}`;
                }
            }
            prevX = x;
            prevY = y;
        });

        pathElem.setAttribute('d', pathData);
        pathElem.setAttribute('stroke', color.css);
        if (areaElem) {
            areaElem.setAttribute('d', `${pathData} L ${prevX} ${chartHeight} L 0 ${chartHeight} Z`);
        }
        if (gradStop) {
            gradStop.setAttribute('stop-color', color.css);
        }
        const chartSvg = pathElem.parentElement;
        chartSvg._coords = coords;
        if (!chartSvg._inspecting) {
            cursorElem.setAttribute('cx', prevX);
            cursorElem.setAttribute('cy', prevY);
            cursorElem.setAttribute('fill', color.css);
            cursorElem.setAttribute('opacity', '1');
        }
    }

    function applyRegionFilter(region, animate = true) {
        activeRegion = region;
        let activeTab = null;
        filterTabs.forEach(tab => {
            const on = tab.dataset.region === region;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', String(on));
            if (on) activeTab = tab;
        });
        moveLiquidGlider(netGlider, activeTab, animate);

        grid.querySelectorAll('.net-card').forEach(card => {
            card.hidden = region !== 'all' && card.dataset.region !== region;
        });
        updateSummary();
    }

    async function probeSiteOnce(site) {
        const id = getSiteId(site);
        const card = grid.querySelector(`.net-card[data-site-id="${id}"]`);
        if (card) replayAnimation(card, 'is-scanning');

        const latency = await testLatency(site);
        if (!siteLatencies[id]) siteLatencies[id] = [];
        siteLatencies[id].push(latency);
        if (siteLatencies[id].length > LATENCY_CONFIG.count) siteLatencies[id].shift();
        updateLatencyDisplay(site);
        updateSummary();
    }

    async function rescanAll() {
        if (rescanBtn) rescanBtn.classList.add('is-spinning');
        await Promise.all(LATENCY_SITES.map(probeSiteOnce));
        if (rescanBtn) rescanBtn.classList.remove('is-spinning');
    }

    function bindCardInteractions() {
        LATENCY_SITES.forEach(site => {
            const id = getSiteId(site);
            const card = grid.querySelector(`.net-card[data-site-id="${id}"]`);
            const chart = document.getElementById(`chart-${id}`);
            const guide = document.getElementById(`guide-${id}`);
            const cursor = document.getElementById(`cursor-${id}`);
            const metaElem = document.getElementById(`meta-${id}`);

            if (card) {
                card.addEventListener('click', () => {
                    SoundEngine.tick(1120, 0.016);
                    probeSiteOnce(site);
                });
            }

            if (chart && guide && cursor && metaElem) {
                chart.addEventListener('pointermove', e => {
                    const coords = chart._coords;
                    if (!coords || !coords.length) return;
                    chart._inspecting = true;
                    const rect = chart.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    let closestIdx = 0;
                    let bestDist = Infinity;
                    coords.forEach((pt, idx) => {
                        const d = Math.abs(pt.x - x);
                        if (d < bestDist) { bestDist = d; closestIdx = idx; }
                    });
                    const pt = coords[closestIdx];
                    guide.setAttribute('x1', pt.x);
                    guide.setAttribute('x2', pt.x);
                    guide.setAttribute('opacity', '1');
                    cursor.setAttribute('cx', pt.x);
                    cursor.setAttribute('cy', pt.y);
                    metaElem.dataset.inspecting = 'true';
                    metaElem.textContent = pt.l === -1 ? `#${closestIdx + 1} · 超时` : `#${closestIdx + 1} · ${pt.l}ms`;
                });

                chart.addEventListener('pointerleave', () => {
                    chart._inspecting = false;
                    guide.setAttribute('opacity', '0');
                    delete metaElem.dataset.inspecting;
                    if (metaElem.dataset.defaultMeta) metaElem.textContent = metaElem.dataset.defaultMeta;
                    const coords = chart._coords;
                    if (coords && coords.length) {
                        const lastPt = coords[coords.length - 1];
                        cursor.setAttribute('cx', lastPt.x);
                        cursor.setAttribute('cy', lastPt.y);
                    }
                });
            }
        });
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            SoundEngine.click(true);
            applyRegionFilter(tab.dataset.region || 'all', true);
        });
    });

    if (rescanBtn) {
        rescanBtn.addEventListener('click', () => {
            SoundEngine.click(true);
            rescanAll();
        });
    }

    function setNetworkCollapsed(isCollapsed) {
        if (!networkSection || !networkToggle) return;
        networkSection.classList.toggle('is-collapsed', isCollapsed);
        networkToggle.setAttribute('aria-expanded', String(!isCollapsed));
        const toggleText = networkToggle.querySelector('span');
        if (toggleText) toggleText.textContent = isCollapsed ? '展开' : '收起';
    }

    if (networkToggle && networkSection) {
        const mobileQuery = window.matchMedia('(max-width: 680px)');
        setNetworkCollapsed(mobileQuery.matches);
        onMediaChange(mobileQuery, e => {
            if (!e.matches) setNetworkCollapsed(false);
        });
        networkToggle.addEventListener('click', () => {
            SoundEngine.click(true);
            setNetworkCollapsed(!networkSection.classList.contains('is-collapsed'));
        });
    }

    async function runLatencyTest() {
        generateLatencyCards();
        bindCardInteractions();
        applyRegionFilter('all', false);
        requestAnimationFrame(() => {
            moveLiquidGlider(netGlider, filterTabs.find(t => t.dataset.region === activeRegion), false);
        });
        window.addEventListener('resize', () => {
            moveLiquidGlider(netGlider, filterTabs.find(t => t.dataset.region === activeRegion), false);
        });

        LATENCY_SITES.forEach(site => {
            siteLatencies[getSiteId(site)] = [];
        });

        await Promise.all(LATENCY_SITES.map(async site => {
            const id = getSiteId(site);
            for (let i = 0; i < LATENCY_CONFIG.count; i++) {
                await waitForVisiblePage();
                const latency = await testLatency(site);
                siteLatencies[id].push(latency);
                updateLatencyDisplay(site);
                updateSummary();
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }));

        async function refreshLoop() {
            try {
                if (isLatencyPageVisible()) {
                    await Promise.all(LATENCY_SITES.map(async site => {
                        const id = getSiteId(site);
                        const latency = await testLatency(site);
                        siteLatencies[id].push(latency);
                        if (siteLatencies[id].length > LATENCY_CONFIG.count) siteLatencies[id].shift();
                        updateLatencyDisplay(site);
                    }));
                    updateSummary();
                }
            } finally {
                setTimeout(refreshLoop, LATENCY_CONFIG.refreshIntervalMs);
            }
        }

        setTimeout(refreshLoop, LATENCY_CONFIG.refreshIntervalMs);
    }

    deskActions.rescanNetwork = rescanAll;
    runLatencyTest().catch(() => {
        if (networkSummary) networkSummary.textContent = '检测初始化异常';
    });
}

// ==========================================================
// 12. 极速预加载收起 & 启动入口
// ==========================================================
function dismissPreloader() {
    const loader = document.getElementById('preloader');
    if (!loader || loader.classList.contains('hidden')) return;
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 400);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dismissPreloader);
} else {
    dismissPreloader();
}
window.addEventListener('load', dismissPreloader);

function boot() {
    SoundEngine.init();
    ThemeSystem.init();
    initSpatialInteractions();
    initSearchAndCommands();
    initChronoAndSolar();
    initHitokoto();
    initWeather();
    fetchGithubStars();
    initPortalPings();
    initContributions();
    initNeonPlayer();
    startLatencyTest();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

console.log(
    '%c LOONG %c 个人工作台 ',
    'background: #e59952; color: #171008; font-weight: 700; padding: 4px 8px; border-radius: 4px 0 0 4px;',
    'background: #16161b; color: #f3f0e8; padding: 4px 8px; border-radius: 0 4px 4px 0;'
);
