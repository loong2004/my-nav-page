// 背景粒子系统
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    // 设置画布大小
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 粒子类
    class Particle {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height;
            this.opacity = Math.random() * 0.5 + 0.2;
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = -10;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = Math.random() * 0.3 + 0.2;
            this.size = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.2;
            // 随机颜色：青色或粉色
            this.color = Math.random() > 0.5 ? '61, 217, 235' : '232, 74, 158';
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // 边界检查
            if (this.y > canvas.height + 10) {
                this.reset();
            }
            if (this.x < -10 || this.x > canvas.width + 10) {
                this.x = Math.random() * canvas.width;
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
            ctx.fill();

            // 添加发光效果
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(${this.color}, ${this.opacity * 0.8})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    // 创建粒子
    const particleCount = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 100);
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // 连接线
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = (1 - distance / 150) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(196, 181, 232, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    // 动画循环
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 更新和绘制粒子
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // 绘制连接线
        drawConnections();

        animationId = requestAnimationFrame(animate);
    }

    animate();

    // 清理函数
    return () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        window.removeEventListener('resize', resizeCanvas);
    };
}

// 2. 搜索配置 (Tab 键循环切换)
const searchEngines = {
    google: { url: "https://www.google.com/search?q=", icon: "fab fa-google", placeholder: "Search with Google..." },
    baidu: { url: "https://www.baidu.com/s?wd=", icon: "fas fa-paw", placeholder: "百度一下，你就知道" },
    bing: { url: "https://www.bing.com/search?q=", icon: "fab fa-microsoft", placeholder: "Search with Bing..." },
    duckduckgo: { url: "https://duckduckgo.com/?q=", icon: "fas fa-shield-alt", placeholder: "Privacy Search..." }
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
    if (e.key === 'Escape') closeEngineMenu();

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
        .catch(() => { document.getElementById('hitokoto_text').innerText = "QUOTE: ONLINE / READY"; });
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
                        finalizeWeather(`WEATHER: ${data.city} / ${data.weather} / ${data.temperature}℃`);
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
                    finalizeWeather(`WEATHER: ${res.location.name} / ${res.now.text} / ${res.now.temperature}℃`);
                } else {
                    finalizeWeather("WEATHER: OFFLINE");
                }
            })
            .catch(() => { finalizeWeather("WEATHER: OFFLINE"); });
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

// 7. 网络状态监控 (Refined: 动态生成 + 实时心跳 + 呼吸感监测)
function checkNetworkStatus() {
    const grid = document.getElementById('network-grid');
    const networkSection = document.getElementById('network-section');
    const networkToggle = document.getElementById('network-toggle');
    const networkSummary = document.getElementById('network-summary');
    
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
                    <span class="net-latency" id="ping-${t.id}">PING</span>
                    <div class="status-dots" id="status-${t.id}">
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    if (networkSummary) networkSummary.innerText = `NETWORK: ${targets.length} NODES STANDBY`;

    function setNetworkCollapsed(isCollapsed) {
        if (!networkSection || !networkToggle) return;
        networkSection.classList.toggle('is-collapsed', isCollapsed);
        networkToggle.setAttribute('aria-expanded', String(!isCollapsed));
        const toggleText = networkToggle.querySelector('span');
        if (toggleText) {
            toggleText.innerText = isCollapsed ? 'SHOW' : 'HIDE';
        }
    }

    if (networkToggle && networkSection) {
        const shouldCollapse = window.matchMedia('(max-width: 600px)').matches;
        setNetworkCollapsed(shouldCollapse);
        networkToggle.addEventListener('click', function() {
            setNetworkCollapsed(!networkSection.classList.contains('is-collapsed'));
        });
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
            if (networkSummary) networkSummary.innerText = `NETWORK: ${targets.length} NODES MONITORING`;
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
            
            // 放慢刷新节奏，减少延迟数字频繁跳动造成的视觉噪音
            const nextDelay = Math.floor(Math.random() * 7000) + 8000; 
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
initParticles(); // 启动粒子系统
selectEngine(currentEngine);
setInterval(updateClock, 1000);
updateClock();
fetchHitokoto();
fetchWeather();
fetchGithubStars();
checkNetworkStatus(); // 启动网络监测

console.log(
    "%c ⚡ LOONG'S TERMINAL %c SYSTEM READY ",
    "background: linear-gradient(135deg, #3dd9eb, #e84a9e); color: #1a0f2e; font-weight: bold; font-size: 14px; padding: 8px 12px; border-radius: 4px 0 0 4px;",
    "background: #1a0f2e; color: #3dd9eb; font-weight: bold; font-size: 14px; border: 2px solid #3dd9eb; padding: 6px 12px; border-radius: 0 4px 4px 0;"
);
