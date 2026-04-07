// 1. 背景设置 (每次刷新随机 + 大陆优先 + 加载失败兜底)
function setFixedBackground() {
    const background = document.querySelector('.background');
    if (!background) return;

    // 首选国内可访问随机源，刷新时附加随机参数规避缓存
    const randomSources = [
        'https://api.paugram.com/wallpaper/?source=sm',
        'https://api.paugram.com/wallpaper/?source=gh',
        'https://api.paugram.com/wallpaper/?source=360'
    ];

    // 随机源异常时的静态兜底，保证始终有背景
    const fallbackSources = [
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1920&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1920&auto=format&fit=crop'
    ];

    const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const cacheBuster = `t=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const randomEndpoint = pickOne(randomSources);
    const primaryUrl = `${randomEndpoint}${randomEndpoint.includes('?') ? '&' : '?'}${cacheBuster}`;
    const fallbackUrl = pickOne(fallbackSources);

    function preloadAndApply(url, onError) {
        const img = new Image();
        img.src = url;

        img.onload = function() {
            background.style.backgroundImage = `url('${url}')`;
            background.style.opacity = '1';
        };

        img.onerror = function() {
            if (typeof onError === 'function') onError();
        };

        if (img.complete && img.naturalWidth > 0) {
            background.style.backgroundImage = `url('${url}')`;
            background.style.opacity = '1';
        }
    }

    preloadAndApply(primaryUrl, function() {
        preloadAndApply(fallbackUrl, function() {
            background.style.backgroundImage = 'linear-gradient(120deg, #0f172a 0%, #1e293b 55%, #0b1120 100%)';
            background.style.opacity = '1';
        });
    });
}

// 2. 搜索配置 (Tab 键循环切换)
const searchEngines = {
    google: { url: "https://www.google.com/search?q=", icon: "fab fa-google", placeholder: "Search with Google..." },
    baidu: { url: "https://www.baidu.com/s?wd=", icon: "fas fa-paw", placeholder: "百度一下，你就知道" },
    bing: { url: "https://www.bing.com/search?q=", icon: "fab fa-microsoft", placeholder: "Search with Bing..." },
    duckduckgo: { url: "https://duckduckgo.com/?q=", icon: "fas fa-shield-alt", placeholder: "Privacy Search..." }
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
    if (searchInput) searchInput.placeholder = engine.placeholder;

    // 关闭菜单并聚焦
    closeEngineMenu();
    if (searchInput) searchInput.focus();
}

function doSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (query) {
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
    if (e.key === 'Escape') closeEngineMenu();
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
        if (e.key === 'Enter') {
            doSearch();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); // 保留 Tab 的原生焦点切换，改为方向键切换引擎
            // 循环切换索引
            currentEngineIndex = (currentEngineIndex + 1) % engineKeys.length;
            selectEngine(engineKeys[currentEngineIndex]);
        }
    });
}

// 3. 实时时钟 + 问候
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    
    const hour = now.getHours();
    let greeting = "你好";
    if (hour < 5) greeting = "夜深了，注意休息";
    else if (hour < 9) greeting = "新的一天，早上好！";
    else if (hour < 13) greeting = "中午好，记得吃饭";
    else if (hour < 18) greeting = "下午好，喝杯茶提提神";
    else if (hour < 23) greeting = "晚上好，享受属于你的时间";
    else greeting = "夜深了，晚安";
    document.getElementById('greeting').innerText = greeting;
}

// 4. 一言 API
function fetchHitokoto() {
    fetchJsonWithRetry('https://v1.hitokoto.cn/?c=a&c=b', {}, { timeout: 3500, retries: 1, retryDelay: 250 })
        .then(data => { document.getElementById('hitokoto_text').innerText = `${data.hitokoto} —— ${data.from}`; })
        .catch(() => { document.getElementById('hitokoto_text').innerText = "System connected. Ready for input."; });
}


// 5. 天气 (高德定位 -> 高德天气 -> 心知备用)
function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');
    if (!statusDiv) return;

    let weatherResolved = false;

    function finalizeWeather(text) {
        if (weatherResolved) return;
        weatherResolved = true;
        statusDiv.innerText = text;
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
        setTimeout(() => {
            if (!weatherResolved) trySeniverse();
        }, 5000);

        AMap.plugin(['AMap.Geolocation', 'AMap.Weather'], function() {
            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: false,
                timeout: 3000
            });
            const weather = new AMap.Weather();

            geolocation.getCityInfo((status, result) => {
                let targetAdcode = amapConfig.defaultCity;
                if (status === 'complete' && result.adcode) {
                    targetAdcode = result.adcode;
                    console.log("定位成功:", result.city);
                } else {
                    console.warn("定位失败，使用默认城市");
                }

                weather.getLive(targetAdcode, (err, data) => {
                    if (!err && data.info === 'OK') {
                        finalizeWeather(`${data.city}: ${data.weather} ${data.temperature}℃`);
                    } else {
                        trySeniverse();
                    }
                });
            });
        });
    }

    function trySeniverse() {
        if (weatherResolved) return;
        console.log("Switching to Seniverse Weather...");
        const url = `https://api.seniverse.com/v3/weather/now.json?key=${seniverseConfig.key}&location=${seniverseConfig.location}&language=zh-Hans&unit=c`;
        fetchJsonWithRetry(url, {}, { timeout: 4000, retries: 1, retryDelay: 300 })
            .then(data => {
                if (data.results && data.results[0]) {
                    const res = data.results[0];
                    finalizeWeather(`${res.location.name}: ${res.now.text} ${res.now.temperature}℃`);
                } else {
                    finalizeWeather("Weather Offline");
                }
            })
            .catch(() => { finalizeWeather("Weather Offline"); });
    }

    startWeatherSystem();
}


// 6. 自动获取 GitHub Star 数（加缓存和错误处理）
function fetchGithubStars() {
    const starCountElem = document.getElementById('github-star-count');
    if (!starCountElem) return;
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
                starCountElem.innerText = "-";
            }
        })
        .catch(err => {
            console.warn("GitHub Star fetch failed:", err.message);
            starCountElem.innerText = "N/A";

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

// 7. 网络状态监控 (Refined: 动态生成 + 实时心跳 + 呼吸感监测)
function checkNetworkStatus() {
    const grid = document.getElementById('network-grid');
    
    // 配置列表
    const targets = [
        { id: 'bytedance', name: '字节跳动', icon: 'fab fa-tiktok', type: 'cn', url: 'https://www.douyin.com/favicon.ico' },
        { id: 'bilibili', name: 'Bilibili', icon: 'fab fa-bilibili', type: 'cn', url: 'https://www.bilibili.com/favicon.ico' },
        { id: 'wechat', name: '微信', icon: 'fab fa-weixin', type: 'cn', url: 'https://weixin.qq.com/favicon.ico' },
        { id: 'taobao', name: '淘宝', icon: 'fas fa-shopping-bag', type: 'cn', url: 'https://www.taobao.com/favicon.ico' },
        { id: 'github', name: 'GitHub', icon: 'fab fa-github', type: 'intl', url: 'https://github.com/favicon.ico' },
        { id: 'jsdelivr', name: 'jsDelivr', icon: 'fas fa-cube', type: 'intl', url: 'https://cdn.jsdelivr.net/favicon.ico' },
        { id: 'cloudflare', name: 'Cloudflare', icon: 'fas fa-cloud', type: 'intl', url: 'https://www.cloudflare.com/favicon.ico' },
        { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', type: 'intl', url: 'https://www.youtube.com/favicon.ico' }
    ];

    // 1. 动态生成卡片 (DRY)
    if (grid) {
        grid.innerHTML = targets.map(t => `
            <div class="net-card">
                <div class="net-header">
                    <span class="net-icon"><i class="${t.icon}"></i> ${t.name}</span>
                    <span class="net-badge badge-${t.type}">${t.type === 'cn' ? '国内' : '国际'}</span>
                </div>
                <div class="net-body">
                    <span class="net-latency" id="ping-${t.id}">WAIT</span>
                    <div class="status-dots" id="status-${t.id}">
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 2. 渲染信号灯 (Helper)
    const renderStatusDots = (latency, elem) => {
        let colorClass = 'green';
        let activeCount = 6;

        if (latency === -1) { // Timeout/Error
            colorClass = 'red';
            activeCount = 1;
        } else if (latency < 100) {
            colorClass = 'green';
            activeCount = 6;
        } else if (latency < 250) {
            colorClass = 'yellow';
            activeCount = 4;
        } else {
            colorClass = 'red';
            activeCount = 2;
        }

        let html = '';
        for (let i = 0; i < 6; i++) {
            const isActive = i < activeCount;
            const className = isActive ? `dot ${colorClass}` : 'dot';
            html += `<div class="${className}"></div>`;
        }
        elem.innerHTML = html;
        return colorClass;
    };

    // 3. 核心测速函数 (单次)
    const pingTarget = async (target) => {
        const textElem = document.getElementById(`ping-${target.id}`);
        const dotsElem = document.getElementById(`status-${target.id}`);
        if (!textElem || !dotsElem) return;

        const onePing = async () => {
            const start = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

            try {
                // mode: 'no-cors' 是必须的，cache: 'no-store' 加上时间戳强制不缓存
                await fetch(`${target.url}?t=${Date.now()}`, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal
                });
                const end = performance.now();
                const jitter = Math.floor(Math.random() * 5);
                return Math.round(end - start) + jitter;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        try {
            let latency;
            try {
                latency = await onePing();
            } catch {
                latency = await onePing(); // 轻量重试一次
            }

            textElem.innerText = `${latency}ms`;
            textElem.title = 'Estimated latency';
            const color = renderStatusDots(latency, dotsElem);
            textElem.className = `net-latency text-${color}`;
        } catch {
            textElem.innerText = 'OFF';
            textElem.className = 'net-latency text-red';
            textElem.title = 'Connectivity unavailable';
            renderStatusDots(-1, dotsElem);
        }
    };

    // 4. 启动无限循环 (Heartbeat Loop)
    targets.forEach(target => {
        const loop = async () => {
            await pingTarget(target);
            
            // 随机间隔 1.5s 到 3.5s，让由于网络波动造成的数值跳动看起来“此起彼伏”
            const nextDelay = Math.floor(Math.random() * 2000) + 1500; 
            setTimeout(loop, nextDelay);
        };
        
        // 错峰启动，防止页面刚加载时瞬间卡顿
        setTimeout(loop, Math.random() * 1000);
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
setFixedBackground(); // 改名调用新函数：设置固定背景
selectEngine(currentEngine);
setInterval(updateClock, 1000);
updateClock();
fetchHitokoto();
fetchWeather();
fetchGithubStars();
checkNetworkStatus(); // 启动网络监测

console.log(
    "%c Loong's Terminal %c System Ready ",
    "background:#06b6d4; color:#000; font-weight:bold; border-radius: 4px 0 0 4px; padding: 4px;",
    "background:#0f172a; color:#06b6d4; font-weight:bold; border: 1px solid #06b6d4; border-radius: 0 4px 4px 0; padding: 3px;"
);