// 兼容旧版 Safari 的 matchMedia 监听
function onMediaChange(mql, handler) {
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else if (mql.addListener) mql.addListener(handler);
}

// 2. 搜索配置（↑ ↓ 循环切换）
const searchEngines = {
    google: { label: "Google", url: "https://www.google.com/search?q=", icon: "fab fa-google", placeholder: "用 Google 搜索..." },
    baidu: { label: "Baidu", url: "https://www.baidu.com/s?wd=", icon: "fas fa-paw", placeholder: "百度一下..." },
    bing: { label: "Bing", url: "https://www.bing.com/search?q=", icon: "fab fa-microsoft", placeholder: "用 Bing 搜索..." },
    duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=", icon: "fas fa-shield-alt", placeholder: "不被追踪地搜索..." }
};

const commandRoutes = {
    '/blog': 'https://monki.de5.net',
    '/pic': 'https://pic.soomin.de5.net',
    '/news': 'https://news.885123.xyz'
};

// 定义引擎顺序，用于 Tab 切换
const engineKeys = Object.keys(searchEngines);
let currentEngineIndex = 2; // 默认 Bing (索引2)
let currentEngine = engineKeys[currentEngineIndex];

const engineSelector = document.getElementById('engine-selector');
const engineOptions = document.getElementById('engine-options');
const selectedEngineButton = document.getElementById('selected-engine');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-btn');
const engineOptionButtons = engineOptions ? Array.from(engineOptions.querySelectorAll('.option')) : [];

function isEditableTarget(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
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

function setEngineMenuState(isOpen) {
    if (!engineOptions || !selectedEngineButton) return;
    engineOptions.classList.toggle('show', isOpen);
    selectedEngineButton.setAttribute('aria-expanded', String(isOpen));
    engineOptions.setAttribute('aria-hidden', String(!isOpen));
}

function toggleEngineMenu() {
    if (!engineOptions) return;
    const willOpen = !engineOptions.classList.contains('show');
    setEngineMenuState(willOpen);
    if (willOpen && engineOptionButtons.length > 0) engineOptionButtons[0].focus();
}

function closeEngineMenu() {
    if (engineOptions && engineOptions.classList.contains('show')) {
        setEngineMenuState(false);
    }
}

function selectEngine(engineKey) {
    if (!searchEngines[engineKey]) return;
    
    // 更新当前索引
    currentEngineIndex = engineKeys.indexOf(engineKey);
    currentEngine = engineKey;
    
    // 更新 UI
    const engine = searchEngines[engineKey];
    document.getElementById('current-engine-icon').className = engine.icon;
    const engineName = document.getElementById('current-engine-name');
    if (engineName) engineName.textContent = engine.label;
    if (searchInput) searchInput.placeholder = engine.placeholder;

    // 关闭菜单并聚焦
    closeEngineMenu();
    if (searchInput) searchInput.focus();
}

function doSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (query) {
        const route = commandRoutes[query.toLowerCase()];
        if (route) {
            window.open(route, '_blank');
            return;
        }
        window.open(searchEngines[currentEngine].url + encodeURIComponent(query), '_blank');
    } else {
        searchInput.focus();
    }
}

// 点击外部关闭菜单
document.addEventListener('click', function(e) {
    if (!engineSelector) return;
    if (!engineSelector.contains(e.target)) closeEngineMenu();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && engineOptions && engineOptions.classList.contains('show')) {
        const focusInMenu = engineOptions.contains(document.activeElement);
        closeEngineMenu();
        // 避免焦点停留在已隐藏的菜单项上
        if (focusInMenu && selectedEngineButton) selectedEngineButton.focus();
    }

    if (e.key === '/' && !isEditableTarget(e.target) && searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
});

// 键盘事件监听 (Enter 搜索, Tab 切换)
if (selectedEngineButton) {
    selectedEngineButton.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleEngineMenu();
    });
    selectedEngineButton.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleEngineMenu();
        }
    });
}

engineOptionButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const key = btn.getAttribute('data-engine');
        if (key) selectEngine(key);
    });
    btn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const key = btn.getAttribute('data-engine');
            if (key) selectEngine(key);
        }
    });
});

if (searchButton) {
    searchButton.addEventListener('click', doSearch);
}

if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
        // 输入法组字中（含 Safari 组字结束时的 229 回车），按键交给输入法处理
        if (e.isComposing || e.keyCode === 229) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            doSearch();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); // 保留 Tab 的原生焦点切换，改为方向键切换引擎
            // ↑ 上一个，↓ 下一个，循环切换
            const step = e.key === 'ArrowUp' ? -1 : 1;
            currentEngineIndex = (currentEngineIndex + step + engineKeys.length) % engineKeys.length;
            selectEngine(engineKeys[currentEngineIndex]);
        }
    });
}

// 3. 实时时钟 + 问候 + 今日读数
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
let lastReadoutKey = '';

// 分段仪表：已过去的格子点亮，当前所在的格子闪烁
function paintMeter(el, count, progress) {
    if (!el) return;
    if (el.childElementCount !== count) {
        el.replaceChildren(...Array.from({ length: count }, () => document.createElement('i')));
    }
    const current = Math.min(Math.floor(progress * count), count - 1);
    Array.from(el.children).forEach((seg, i) => {
        seg.className = i < current ? 'is-on' : (i === current ? 'is-now' : '');
    });
}

function updateReadout(now) {
    const dateEl = document.getElementById('readout-date');
    if (!dateEl) return;
    const key = `${now.toDateString()} ${now.getHours()}:${now.getMinutes()}`;
    if (key === lastReadoutKey) return; // 每分钟刷新一次即可
    lastReadoutKey = key;

    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const pad = n => String(n).padStart(2, '0');
    dateEl.textContent = `${y}.${pad(m + 1)}.${pad(d)}`;
    dateEl.dateTime = `${y}-${pad(m + 1)}-${pad(d)}`;
    document.getElementById('readout-week').textContent = WEEKDAYS[now.getDay()];

    const dayProgress = (now.getHours() * 60 + now.getMinutes()) / 1440;
    document.getElementById('day-pct').textContent = `${Math.floor(dayProgress * 100)}%`;
    paintMeter(document.getElementById('day-meter'), 24, dayProgress);

    const startOfYear = new Date(y, 0, 1);
    const yearProgress = (now - startOfYear) / (new Date(y + 1, 0, 1) - startOfYear);
    const dayOfYear = Math.round((new Date(y, m, d) - startOfYear) / 86400000) + 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    document.getElementById('year-day').textContent = String(dayOfYear);
    document.getElementById('year-pct').textContent = `${Math.floor(yearProgress * 100)}%`;
    // 12 格按月份点亮
    paintMeter(document.getElementById('year-meter'), 12, (m + (d - 1) / daysInMonth) / 12);
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    
    const hour = now.getHours();
    let greeting = "你好";
    if (hour < 5) greeting = "夜深了，注意休息";
    else if (hour < 9) greeting = "新的一天，早上好！";
    else if (hour < 11) greeting = "上午好，保持专注";
    else if (hour < 13) greeting = "中午好，记得吃饭";
    else if (hour < 18) greeting = "下午好，喝杯茶提提神";
    else if (hour < 23) greeting = "晚上好，享受属于你的时间";
    else greeting = "夜深了，晚安";
    document.getElementById('greeting').innerText = greeting;
    updateReadout(now);
}

// 4. 一言 API
function fetchHitokoto() {
    fetchJsonWithRetry('https://v1.hitokoto.cn/?c=a&c=b', {}, { timeout: 3500, retries: 1, retryDelay: 250 })
        .then(data => { document.getElementById('hitokoto_text').innerText = `${data.hitokoto} —— ${data.from}`; })
        .catch(() => { document.getElementById('hitokoto_text').innerText = "生活明朗，万物可爱。"; });
}


// 5. 天气 (高德定位 -> 高德天气 -> 心知备用)
function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');
    if (!statusDiv) return;

    // 只更新文字，保留前面的定位图标
    const statusText = statusDiv.querySelector('span') || statusDiv;
    const AMAP_TIMEOUT_MS = 6000;

    let weatherResolved = false;
    let seniverseStarted = false;
    let amapTimer = null;

    function finalizeWeather(text) {
        if (weatherResolved) return;
        weatherResolved = true;
        clearTimeout(amapTimer);
        statusText.textContent = text;
    }

    const amapConfig = {
        key: '02d4bd74cc1897fcb432cc2f77f15098',
        securityCode: 'fd70b506e58e5953e91efe72322b9aff',
        defaultCity: '320100' // 南京
    };

    const seniverseConfig = {
        key: 'SBhWcvdeh-GwBOsHR',
        location: 'ip'
    };

    function startWeatherSystem() {
        // 总超时从加载高德脚本时开始计时：脚本挂起、定位或天气卡住都会切到备用
        amapTimer = setTimeout(trySeniverse, AMAP_TIMEOUT_MS);
        window._AMapSecurityConfig = { securityJsCode: amapConfig.securityCode };

        if (typeof AMap === 'undefined') {
            const script = document.createElement('script');
            script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapConfig.key}`;
            script.onload = runAmapLogic;
            script.onerror = trySeniverse; // 脚本加载失败直接切备用
            document.head.appendChild(script);
        } else {
            runAmapLogic();
        }
    }

    function runAmapLogic() {
        if (typeof AMap === 'undefined' || typeof AMap.plugin !== 'function') {
            trySeniverse();
            return;
        }

        AMap.plugin(['AMap.Geolocation', 'AMap.Weather'], function() {
            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: false,
                timeout: 3000
            });
            const weather = new AMap.Weather();

            geolocation.getCityInfo((status, result) => {
                // 定位失败时使用默认城市
                const targetAdcode = status === 'complete' && result.adcode ? result.adcode : amapConfig.defaultCity;

                weather.getLive(targetAdcode, (err, data) => {
                    if (!err && data.info === 'OK') {
                        finalizeWeather(`${data.city} · ${data.weather} · ${data.temperature}℃`);
                    } else {
                        trySeniverse();
                    }
                });
            });
        });
    }

    function trySeniverse() {
        if (weatherResolved || seniverseStarted) return; // 防止超时和失败回调各触发一次
        seniverseStarted = true;
        clearTimeout(amapTimer);
        const url = `https://api.seniverse.com/v3/weather/now.json?key=${seniverseConfig.key}&location=${seniverseConfig.location}&language=zh-Hans&unit=c`;
        fetchJsonWithRetry(url, {}, { timeout: 4000, retries: 1, retryDelay: 300 })
            .then(data => {
                if (data.results && data.results[0]) {
                    const res = data.results[0];
                    finalizeWeather(`${res.location.name} · ${res.now.text} · ${res.now.temperature}℃`);
                } else {
                    finalizeWeather("天气暂不可用");
                }
            })
            .catch(() => { finalizeWeather("天气暂不可用"); });
    }

    startWeatherSystem();
}


// 6. 自动获取 GitHub Star 数（加缓存和错误处理）
function fetchGithubStars() {
    const starCountElem = document.getElementById('github-star-count');
    if (!starCountElem) return;
    starCountElem.innerText = 'SYNC';
    const CACHE_KEY = 'gh_stars_cache';
    const CACHE_TIME = 3600000; // 1小时
    
    // 检查缓存
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const { stars, time } = JSON.parse(cached);
            if (Date.now() - time < CACHE_TIME) {
                starCountElem.innerText = stars;
                return;
            }
        } catch {
            localStorage.removeItem(CACHE_KEY);
        }
    }
    
    fetchWithTimeout('https://api.github.com/repos/loong2004/my-nav-page', {}, 4500)
        .then(response => {
            if (response.status === 403 || response.status === 429) {
                const err = new Error("RATE_LIMIT");
                err.status = response.status;
                throw err;
            }
            if (!response.ok) {
                const err = new Error(`HTTP_${response.status}`);
                err.status = response.status;
                throw err;
            }
            return response.json();
        })
        .then(data => {
            if (data.stargazers_count !== undefined) {
                const stars = data.stargazers_count;
                starCountElem.innerText = stars;
                // 缓存结果
                localStorage.setItem(CACHE_KEY, JSON.stringify({ stars, time: Date.now() }));
            } else {
                starCountElem.innerText = "OFF";
            }
        })
        .catch(err => {
            console.warn("GitHub Star fetch failed:", err.message);
            starCountElem.innerText = "OFF";

            if (err.name === 'AbortError') {
                starCountElem.title = "GitHub API Timeout";
            } else if (err.message === 'RATE_LIMIT') {
                starCountElem.title = "GitHub API Rate Limit";
            } else if (err.message && err.message.startsWith('HTTP_')) {
                starCountElem.title = `GitHub API Error (${err.message.replace('HTTP_', '')})`;
            } else {
                starCountElem.title = "GitHub API Network Error";
            }
        });
}

// 7. 延迟测试功能 (纯前端 RTT 测量)
function startLatencyTest() {
    // ========== 配置 ==========
    const LATENCY_CONFIG = {
        count: 16,                    // 滑动窗口采样点数
        probeTimeoutMs: 5000,         // 单次探测超时
        refreshIntervalMs: 1236,      // 持续刷新间隔 (618*2)
        waitVisiblePollMs: 300,       // 页签可见性轮询间隔
        chartMaxMs: 500               // 折线图 Y 轴上限
    };

    // 探针站点配置 (国内优先)
    const LATENCY_SITES = [
        // 国内
        { name: 'Bilibili', region: '国内', icon: 'fab fa-bilibili', url: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
        { name: '微信', region: '国内', icon: 'fab fa-weixin', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
        { name: '淘宝', region: '国内', icon: 'fas fa-shopping-bag', url: 'https://www.taobao.com/favicon.ico' },
        { name: '字节跳动', region: '国内', icon: 'fab fa-tiktok', url: 'https://lf3-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico' },
        // 国际
        { name: 'GitHub', region: '国际', icon: 'fab fa-github', url: 'https://github.githubassets.com/favicon.ico' },
        { name: 'jsDelivr', region: '国际', icon: 'fas fa-cube', url: 'https://cdn.jsdelivr.net/npm/latency-test@1.0.0/generate_200' },
        { name: 'Cloudflare', region: '国际', icon: 'fas fa-cloud', url: 'https://www.cloudflare.com/favicon.ico' },
        { name: 'YouTube', region: '国际', icon: 'fab fa-youtube', url: 'https://www.youtube.com/favicon.ico' }
    ];

    const grid = document.getElementById('network-grid');
    const networkSection = document.getElementById('network-section');
    const networkToggle = document.getElementById('network-toggle');
    const networkSummary = document.getElementById('network-summary');

    if (!grid) return;

    // 站点延迟数据存储 {siteId: [latency1, latency2, ...]}
    const siteLatencies = {};

    function getSiteId(site) {
        return site.name.toLowerCase().replace(/\s+/g, '-');
    }

    // ========== 核心测速函数 ==========
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

    // ========== 页签可见性检测 ==========
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

    // ========== UI 生成 ==========
    function generateLatencyCards() {
        grid.innerHTML = LATENCY_SITES.map(site => {
            const id = getSiteId(site);
            return `
                <div class="net-card">
                    <span class="net-name"><i class="${site.icon}" aria-hidden="true"></i>${site.name}</span>
                    <span class="net-badge">${site.region === '国内' ? 'CN' : 'INTL'}</span>
                    <svg class="latency-chart" height="28" id="chart-${id}" aria-hidden="true">
                        <path id="path-${id}" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path>
                        <circle id="cursor-${id}" r="2.5" fill="var(--text)" opacity="0"></circle>
                    </svg>
                    <span class="net-latency" id="latency-${id}">—</span>
                </div>
            `;
        }).join('');
    }

    // ========== 颜色分档 ==========
    function getLatencyColor(latency) {
        if (latency === -1 || latency >= 300) return { class: 'red', css: 'var(--status-red)' };
        if (latency >= 150) return { class: 'yellow', css: 'var(--status-yellow)' };
        return { class: 'green', css: 'var(--status-green)' };
    }

    // ========== UI 更新 (数值 + 折线图) ==========
    function updateLatencyDisplay(site) {
        const id = getSiteId(site);
        const latencies = siteLatencies[id] || [];
        if (latencies.length === 0) return;

        const textElem = document.getElementById(`latency-${id}`);
        const pathElem = document.getElementById(`path-${id}`);
        const cursorElem = document.getElementById(`cursor-${id}`);

        if (!textElem || !pathElem || !cursorElem) return;

        // 计算有效样本平均值
        const validSamples = latencies.filter(l => l !== -1);
        const lastLatency = latencies[latencies.length - 1];

        let displayValue, color;
        if (validSamples.length === 0 && lastLatency === -1) {
            displayValue = 'TIMEOUT';
            color = getLatencyColor(-1);
        } else if (validSamples.length > 0) {
            const avg = validSamples.reduce((sum, l) => sum + l, 0) / validSamples.length;
            displayValue = `${Math.round(avg)}ms`;
            color = getLatencyColor(Math.round(avg));
        } else {
            displayValue = 'PING';
            color = getLatencyColor(-1);
        }

        // 更新数值
        textElem.innerText = displayValue;
        textElem.className = `net-latency text-${color.class}`;

        // 绘制折线图
        const chartWidth = pathElem.parentElement.clientWidth || 200;
        const chartHeight = 28;
        const points = latencies.slice(-LATENCY_CONFIG.count);

        if (points.length < 2) return;

        const xStep = chartWidth / (LATENCY_CONFIG.count - 1);
        let pathData = '';
        let prevX = 0;
        let prevY = 0;

        points.forEach((l, i) => {
            const x = i * xStep;
            let y;
            if (l === -1) {
                y = chartHeight; // 失败贴底
            } else {
                const clampedL = Math.min(l, LATENCY_CONFIG.chartMaxMs);
                y = chartHeight - (clampedL / LATENCY_CONFIG.chartMaxMs) * chartHeight;
            }

            if (i === 0) {
                pathData = `M ${x} ${y}`;
            } else {
                // 中点二次贝塞尔平滑：以上一个真实采样点为控制点，终点为两点中点
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

        // 光标定位到最后一个点
        cursorElem.setAttribute('cx', prevX);
        cursorElem.setAttribute('cy', prevY);
        cursorElem.setAttribute('opacity', '1');

        pathElem.setAttribute('d', pathData);
        pathElem.setAttribute('stroke', color.css);
    }

    // ========== 折叠控制 ==========
    function setNetworkCollapsed(isCollapsed) {
        if (!networkSection || !networkToggle) return;
        networkSection.classList.toggle('is-collapsed', isCollapsed);
        networkToggle.setAttribute('aria-expanded', String(!isCollapsed));
        const toggleText = networkToggle.querySelector('span');
        if (toggleText) {
            toggleText.innerText = isCollapsed ? '展开' : '收起';
        }
    }

    if (networkToggle && networkSection) {
        // 与 CSS 断点保持一致：折叠按钮只在 ≤680px 时显示
        const mobileQuery = window.matchMedia('(max-width: 680px)');
        setNetworkCollapsed(mobileQuery.matches);
        // 切到宽屏时按钮被隐藏，必须展开，否则测速会一直暂停
        onMediaChange(mobileQuery, function(e) {
            if (!e.matches) setNetworkCollapsed(false);
        });
        networkToggle.addEventListener('click', function() {
            setNetworkCollapsed(!networkSection.classList.contains('is-collapsed'));
        });
    }

    // ========== 主流程：初始采样 + 持续刷新 ==========
    async function runLatencyTest() {
        generateLatencyCards();

        if (networkSummary) {
            networkSummary.innerText = `采样中 · ${LATENCY_SITES.length} 个节点`;
        }

        // 初始化每个站点的数据数组
        LATENCY_SITES.forEach(site => {
            const id = getSiteId(site);
            siteLatencies[id] = [];
        });

        // 首轮采样 (各站点并行，站内串行)
        await Promise.all(LATENCY_SITES.map(async site => {
            const id = getSiteId(site);

            for (let i = 0; i < LATENCY_CONFIG.count; i++) {
                await waitForVisiblePage();
                const latency = await testLatency(site);
                siteLatencies[id].push(latency);
                updateLatencyDisplay(site);
                await new Promise(resolve => setTimeout(resolve, 0)); // 让出事件循环
            }
        }));

        if (networkSummary) {
            networkSummary.innerText = `实时监测 · ${LATENCY_SITES.length} 个节点`;
        }

        // 持续刷新：上一轮全部完成后再排下一轮，避免慢网络下请求堆积
        async function refreshLoop() {
            try {
                if (isLatencyPageVisible()) { // 页签不可见则跳过
                    await Promise.all(LATENCY_SITES.map(async site => {
                        const id = getSiteId(site);
                        const latency = await testLatency(site);

                        siteLatencies[id].push(latency);
                        if (siteLatencies[id].length > LATENCY_CONFIG.count) {
                            siteLatencies[id].shift(); // 移除最旧样本
                        }

                        updateLatencyDisplay(site);
                    }));
                }
            } finally {
                setTimeout(refreshLoop, LATENCY_CONFIG.refreshIntervalMs);
            }
        }

        setTimeout(refreshLoop, LATENCY_CONFIG.refreshIntervalMs);
    }

    runLatencyTest().catch(err => {
        console.error('Latency test failed:', err);
        if (networkSummary) {
            networkSummary.innerText = '检测失败';
        }
    });
}

// 9. 音乐播放器 NEON DECK（自研界面，数据来自 Meting API）
function initNeonPlayer() {
    const root = document.getElementById('neon-player');
    if (!root || !root.dataset.id) return;

    const config = {
        api: root.dataset.api || 'https://api.injahow.cn/meting/',
        server: root.dataset.server || 'netease',
        type: root.dataset.type || 'playlist',
        id: root.dataset.id
    };

    const RING_CIRCUMFERENCE = 2 * Math.PI * 34;
    const MAX_ERROR_STREAK = 5;      // 连续多少首无法播放后停止自动跳过
    const PREFS_KEY = 'neon_player_prefs';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    root.innerHTML = `
        <div class="np-ripple" aria-hidden="true"></div>
        <section class="np-drawer" aria-label="播放列表">
            <div class="np-drawer-head">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input class="np-search" type="search" placeholder="过滤歌曲 / 歌手" autocomplete="off" spellcheck="false" aria-label="过滤播放列表">
                <span class="np-count">000</span>
            </div>
            <ol class="np-list"></ol>
        </section>
        <div class="np-panel">
            <div class="np-shell" aria-hidden="true"></div>
            <div class="np-head">
                <span class="np-kicker">
                    <span class="np-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                    <span class="np-status">LOADING</span>
                </span>
                <span class="np-index">---/---</span>
                <div class="np-head-actions">
                    <button class="np-btn np-shuffle" type="button" aria-label="随机播放" title="随机播放" aria-pressed="true"><i class="fa-solid fa-shuffle" aria-hidden="true"></i></button>
                    <button class="np-btn np-list-toggle" type="button" aria-label="播放列表" title="播放列表" aria-expanded="false"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button>
                    <button class="np-btn np-collapse" type="button" aria-label="收起播放器" title="收起"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
                </div>
            </div>
            <p class="np-lyric"><span class="np-lyric-text">正在接入音乐频道...</span></p>
            <button class="np-disc" type="button" aria-label="展开音乐播放器">
                <svg class="np-ring" viewBox="0 0 72 72" aria-hidden="true">
                    <circle class="np-ring-track" cx="36" cy="36" r="34"></circle>
                    <circle class="np-ring-progress" cx="36" cy="36" r="34"></circle>
                </svg>
                <span class="np-vinyl"><img class="np-cover" src="./avatar.jpg" alt="" decoding="async"></span>
                <span class="np-disc-overlay" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
            </button>
            <div class="np-info">
                <div class="np-title"><span class="np-title-text">NEON DECK</span></div>
                <div class="np-artist">—</div>
                <div class="np-bar" role="slider" tabindex="0" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <span class="np-buffer"></span>
                    <span class="np-played"></span>
                </div>
                <div class="np-controls">
                    <span class="np-time"><span class="np-current">00:00</span><span class="np-total"> / --:--</span></span>
                    <div class="np-buttons">
                        <button class="np-btn np-prev" type="button" aria-label="上一首" title="上一首"><i class="fa-solid fa-backward-step" aria-hidden="true"></i></button>
                        <button class="np-btn np-play" type="button" aria-label="播放" title="播放"><i class="fa-solid fa-play" aria-hidden="true"></i></button>
                        <button class="np-btn np-next" type="button" aria-label="下一首" title="下一首"><i class="fa-solid fa-forward-step" aria-hidden="true"></i></button>
                    </div>
                </div>
            </div>
        </div>
        <div class="np-ticker" aria-hidden="true"></div>
    `;

    const $ = selector => root.querySelector(selector);
    const els = {
        status: $('.np-status'),
        index: $('.np-index'),
        shuffle: $('.np-shuffle'),
        listToggle: $('.np-list-toggle'),
        collapse: $('.np-collapse'),
        lyric: $('.np-lyric-text'),
        disc: $('.np-disc'),
        ring: $('.np-ring-progress'),
        cover: $('.np-cover'),
        overlayIcon: $('.np-disc-overlay i'),
        title: $('.np-title'),
        titleText: $('.np-title-text'),
        artist: $('.np-artist'),
        bar: $('.np-bar'),
        buffer: $('.np-buffer'),
        played: $('.np-played'),
        current: $('.np-current'),
        total: $('.np-total'),
        prev: $('.np-prev'),
        play: $('.np-play'),
        playIcon: $('.np-play i'),
        next: $('.np-next'),
        search: $('.np-search'),
        count: $('.np-count'),
        list: $('.np-list'),
        ticker: $('.np-ticker')
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
    let tickerTimer = null;
    let motionTimers = [];

    // ---------- 偏好设置 ----------
    const prefs = (() => {
        try {
            return { expanded: false, shuffle: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
        } catch {
            return { expanded: false, shuffle: true };
        }
    })();

    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* 隐私模式下忽略 */ }
    }

    // ---------- 工具函数 ----------
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

    function replayAnimation(el, className) {
        if (reducedMotion.matches) return;
        el.classList.remove(className);
        void el.offsetWidth; // 强制回流，重新触发动画
        el.classList.add(className);
    }

    // ---------- 展开 / 收起 ----------
    // 与 CSS 中 .np-shell 的过渡时长对应：收起时右边缘约 0.62s 回到唱片
    const LANDING_DELAY_MS = 560;
    const MOTION_CLEANUP_MS = 700;

    function clearMotion() {
        motionTimers.forEach(clearTimeout);
        motionTimers = [];
        root.classList.remove('is-expanding', 'is-landing');
    }

    function later(fn, ms) {
        motionTimers.push(setTimeout(fn, ms));
    }

    function setExpanded(expanded, animate = true) {
        if (animate && root.classList.contains('is-expanded') === expanded) return;
        clearMotion();

        if (!animate) {
            // 首次渲染直接到位
            root.classList.add('is-instant');
            requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-instant')));
        } else if (!reducedMotion.matches) {
            if (expanded) {
                root.classList.add('is-expanding');
                later(() => root.classList.remove('is-expanding'), MOTION_CLEANUP_MS);
            } else {
                // 面板缩回唱片的瞬间触发果冻回弹 + 涟漪
                later(() => {
                    root.classList.add('is-landing');
                    later(() => root.classList.remove('is-landing'), MOTION_CLEANUP_MS);
                }, LANDING_DELAY_MS);
            }
        }

        root.classList.toggle('is-expanded', expanded);
        els.disc.setAttribute('aria-label', expanded ? '播放 / 暂停' : '展开音乐播放器');
        if (!expanded) setListOpen(false);
        prefs.expanded = expanded;
        savePrefs();
        // 等内容可见后再测量标题是否需要滚动
        setTimeout(updateMarquee, 260);
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

    function flashTicker() {
        if (root.classList.contains('is-expanded')) return;
        root.classList.add('show-ticker');
        clearTimeout(tickerTimer);
        tickerTimer = setTimeout(() => root.classList.remove('show-ticker'), 3200);
    }

    // ---------- 标题滚动 ----------
    function updateMarquee() {
        const text = els.titleText;
        text.classList.remove('is-scrolling');
        els.title.classList.remove('has-overflow');
        if (!root.classList.contains('is-expanded')) return;

        const overflow = text.scrollWidth - els.title.clientWidth;
        if (overflow > 4) {
            text.style.setProperty('--np-shift', `${-overflow - 16}px`);
            text.style.setProperty('--np-marquee-duration', `${Math.max(5, overflow / 22)}s`);
            els.title.classList.add('has-overflow');
            text.classList.add('is-scrolling');
        }
    }

    // ---------- 歌词 ----------
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

    function setLyric(text, animate) {
        if (els.lyric.textContent === text) return;
        els.lyric.textContent = text;
        if (animate) replayAnimation(els.lyric, 'is-entering');
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
        setLyric(i === -1 ? '· · ·' : lyrics[i].text, true);
    }

    function loadLyrics(track) {
        const token = ++lyricToken;
        lyrics = [];
        lyricIndex = -2;
        setLyric('歌词加载中...', false);
        if (!track.lrc) {
            setLyric('暂无歌词，请欣赏', false);
            return;
        }

        fetchWithTimeout(track.lrc, {}, 6000)
            .then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP_${res.status}`))))
            .then(text => {
                if (token !== lyricToken) return; // 已切歌，丢弃旧结果
                lyrics = parseLrc(text);
                if (!lyrics.length) {
                    setLyric(text.includes('纯音乐') ? '纯音乐，请欣赏' : '暂无歌词，请欣赏', false);
                    return;
                }
                // 尚未开始播放时保留提示语，开始播放后再同步歌词
                if (!audio.paused || audio.currentTime > 0) syncLyric(audio.currentTime);
            })
            .catch(() => {
                if (token === lyricToken) setLyric('歌词暂时无法获取', false);
            });
    }

    // ---------- 进度 ----------
    function renderProgress(ratio) {
        const clamped = Math.min(Math.max(ratio, 0), 1);
        els.played.style.width = `${clamped * 100}%`;
        els.ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - clamped));
        els.bar.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
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

    // ---------- 播放列表 ----------
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
        els.count.textContent = `${tracks.length} TRACKS`;
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
        els.count.textContent = query ? `${visible}/${tracks.length}` : `${tracks.length} TRACKS`;
        if (query) els.list.scrollTop = 0;
        else scrollActiveIntoView();
    }

    // ---------- 播放控制 ----------
    function updateMediaSession(track) {
        if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            album: 'NEON DECK',
            artwork: track.pic ? [{ src: track.pic, sizes: '300x300' }] : []
        });
    }

    function loadTrack(i, autoplay) {
        if (!tracks.length) return;
        index = (i + tracks.length) % tracks.length;
        const track = tracks[index];

        audio.src = track.url;
        els.cover.src = track.pic || './avatar.jpg';
        els.titleText.textContent = track.name;
        els.artist.textContent = track.artist;
        els.ticker.textContent = `♪ ${track.name} — ${track.artist}`;
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
        if (!autoplay) setLyric('点击播放，开始今天的配乐', false);
        updateMediaSession(track);

        if (autoplay) {
            play();
            flashTicker();
        }
    }

    function play() {
        if (!tracks.length) return;
        wantsPlay = true;
        if (!audio.src) loadTrack(index < 0 ? 0 : index, false);
        const promise = audio.play();
        if (promise && promise.catch) {
            promise.catch(err => {
                // 切歌打断旧的 play() 会抛 AbortError，属正常现象
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
        playHistory.push(index);
        if (playHistory.length > 100) playHistory.shift();
        loadTrack(pickNextIndex(), true);
    }

    function prev() {
        if (!tracks.length) return;
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
        const icon = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        els.playIcon.className = icon;
        els.overlayIcon.className = icon;
        els.play.setAttribute('aria-label', playing ? '暂停' : '播放');
        els.play.title = playing ? '暂停' : '播放';
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
        }
    }

    // ---------- 音频事件 ----------
    audio.addEventListener('play', () => setPlayingUI(true));
    audio.addEventListener('pause', () => {
        setPlayingUI(false);
        if (tracks.length && !audio.ended) setStatus('STANDBY');
    });
    audio.addEventListener('playing', () => {
        errorStreak = 0;
        setStatus('NOW PLAYING');
        lyricIndex = -2; // 强制刷新一次歌词（替换掉提示语）
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
        const duration = audio.duration;
        els.current.textContent = formatTime(audio.currentTime);
        renderProgress(canSeek() ? audio.currentTime / duration : 0);
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
            setLyric('连续多首无法播放，请稍后再试', true);
            return;
        }
        setStatus('SKIPPING');
        setLyric('这首暂时无法播放，自动跳过...', true);
        setTimeout(() => {
            if (wantsPlay) next();
        }, 800);
    });

    // ---------- 交互 ----------
    els.disc.addEventListener('click', () => {
        if (!root.classList.contains('is-expanded')) setExpanded(true);
        else togglePlay();
    });
    els.collapse.addEventListener('click', () => setExpanded(false));
    els.play.addEventListener('click', togglePlay);
    els.next.addEventListener('click', next);
    els.prev.addEventListener('click', prev);
    els.shuffle.addEventListener('click', () => setShuffle(!prefs.shuffle));
    els.listToggle.addEventListener('click', () => {
        setListOpen(!root.classList.contains('is-list-open'));
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

    // 进度条拖动
    els.bar.addEventListener('pointerdown', e => {
        if (!canSeek()) return;
        isSeeking = true;
        els.bar.classList.add('is-seeking');
        els.bar.setPointerCapture(e.pointerId);
        seekRatio = ratioFromPointer(e);
        renderProgress(seekRatio);
        els.current.textContent = formatTime(seekRatio * audio.duration);
    });
    els.bar.addEventListener('pointermove', e => {
        if (!isSeeking) return;
        seekRatio = ratioFromPointer(e);
        renderProgress(seekRatio);
        els.current.textContent = formatTime(seekRatio * audio.duration);
    });
    function endSeek() {
        if (!isSeeking) return;
        isSeeking = false;
        els.bar.classList.remove('is-seeking');
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

    // 点击外部关闭列表；Esc 先关列表、再收起
    document.addEventListener('click', e => {
        if (root.classList.contains('is-list-open') && !root.contains(e.target)) setListOpen(false);
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (root.classList.contains('is-list-open')) {
            setListOpen(false);
            els.listToggle.focus();
        } else if (root.classList.contains('is-expanded') && root.contains(document.activeElement)) {
            setExpanded(false);
            els.disc.focus();
        }
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateMarquee, 150);
    });

    els.cover.addEventListener('error', () => {
        if (!els.cover.src.endsWith('avatar.jpg')) els.cover.src = './avatar.jpg';
    });

    if ('mediaSession' in navigator) {
        const handlers = {
            play: play,
            pause: pause,
            previoustrack: prev,
            nexttrack: next
        };
        Object.entries(handlers).forEach(([action, handler]) => {
            try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* 不支持的动作 */ }
        });
    }

    // ---------- 初始化 ----------
    els.ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    renderProgress(0);
    setShuffle(prefs.shuffle !== false);
    setExpanded(Boolean(prefs.expanded), false);

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
        })
        .catch(err => {
            console.warn('Playlist load failed:', err.message);
            root.classList.add('is-offline');
            setStatus('OFFLINE');
            els.titleText.textContent = 'NO SIGNAL';
            els.artist.textContent = '音乐频道暂时无法连接';
            setLyric('歌单加载失败，请稍后刷新重试', false);
        });
}

// 10. GitHub 提交点阵（数据来自 github-contributions-api.jogruber.de，支持跨域）
function initContributions() {
    const box = document.getElementById('contrib');
    const grid = document.getElementById('contrib-grid');
    const total = document.getElementById('contrib-total');
    if (!box || !grid || !total || !box.dataset.user) return;

    const user = box.dataset.user;
    const CACHE_KEY = `contrib_cache_${user}`;
    const CACHE_TIME = 6 * 3600000; // 6 小时
    let rendered = false;

    function render(data) {
        const days = Array.isArray(data && data.contributions) ? data.contributions : [];
        if (!days.length) throw new Error('EMPTY');

        const fragment = document.createDocumentFragment();
        // 第一列从周日开始，前面补空位
        const firstWeekday = new Date(`${days[0].date}T00:00:00`).getDay();
        for (let i = 0; i < firstWeekday; i++) {
            const pad = document.createElement('i');
            pad.className = 'is-pad';
            fragment.appendChild(pad);
        }
        days.forEach((day, index) => {
            const dot = document.createElement('i');
            dot.style.setProperty('--col', String(Math.floor((index + firstWeekday) / 7)));
            if (day.level > 0) dot.dataset.l = String(Math.min(day.level, 4));
            dot.title = `${day.date} · ${day.count} 次提交`;
            fragment.appendChild(dot);
        });
        grid.replaceChildren(fragment);

        const sum = data.total && typeof data.total === 'object'
            ? Object.values(data.total).reduce((acc, n) => acc + (Number(n) || 0), 0)
            : days.reduce((acc, day) => acc + (day.count || 0), 0);
        total.innerHTML = `过去一年 <strong>${sum}</strong> 次提交`;

        // 小屏横向滚动时，默认显示最近的几周
        const scroller = grid.parentElement;
        scroller.scrollLeft = scroller.scrollWidth;
        rendered = true;
    }

    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && cached.data) {
            render(cached.data);
            if (Date.now() - cached.time < CACHE_TIME) return;
        }
    } catch {
        localStorage.removeItem(CACHE_KEY);
    }

    fetchJsonWithRetry(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`, {}, { timeout: 8000, retries: 1, retryDelay: 500 })
        .then(data => {
            render(data);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, time: Date.now() })); } catch { /* 存储已满时忽略 */ }
        })
        .catch(() => {
            if (rendered) return;
            box.classList.add('is-failed');
            total.innerHTML = `提交记录暂时读取失败，<a href="https://github.com/${encodeURIComponent(user)}" target="_blank" rel="noopener noreferrer">去 GitHub 查看</a>`;
        });
}

// 8. 极速预加载控制 (System Initialization - Turbo Mode)
// 修正逻辑：DOM 准备好立刻显示，不再等待所有资源加载完毕
document.addEventListener('DOMContentLoaded', function() {
    const loader = document.getElementById('preloader');
    
    // 立即隐藏，无额外延迟
    loader.classList.add('hidden');
    
    // 动画结束后彻底移除元素，释放内存
    setTimeout(() => {
        loader.style.display = 'none';
    }, 500); 
});

// 兜底策略：以防 DOMContentLoaded 未触发
window.addEventListener('load', function() {
    const loader = document.getElementById('preloader');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
        setTimeout(() => { loader.style.display = 'none'; }, 500);
    }
});

// 初始化
selectEngine(currentEngine);
setInterval(updateClock, 1000);
updateClock();
fetchHitokoto();
fetchWeather();
fetchGithubStars();
initContributions();
initNeonPlayer();

// 启动延迟测试 (使用 DOM ready 检测确保在正确时机运行)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLatencyTest);
} else {
    startLatencyTest();
}

console.log(
    "%c LOONG %c 个人终端 · 手工搭建 ",
    "background: #ff5b1f; color: #1c0c05; font-weight: 600; padding: 4px 8px; border-radius: 3px 0 0 3px;",
    "background: #1b1b18; color: #ece8dc; padding: 4px 8px; border-radius: 0 3px 3px 0;"
);
