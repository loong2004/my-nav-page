// 1. 随机二次元背景
function setRandomBackground() {
    const baseUrl = "https://api.paugram.com/wallpaper/";
    const timestamp = new Date().getTime();
    const finalUrl = `${baseUrl}?t=${timestamp}`;
    const background = document.querySelector('.background');
    const img = new Image();
    img.src = finalUrl;
    img.onload = function() { background.style.backgroundImage = `url('${finalUrl}')`; };
}

// 2. 搜索配置
const searchEngines = {
    google: { url: "https://www.google.com/search?q=", icon: "fab fa-google", placeholder: "Search with Google..." },
    baidu: { url: "https://www.baidu.com/s?wd=", icon: "fas fa-paw", placeholder: "百度一下，你就知道" },
    bing: { url: "https://www.bing.com/search?q=", icon: "fab fa-microsoft", placeholder: "Search with Bing..." },
    duckduckgo: { url: "https://duckduckgo.com/?q=", icon: "fas fa-shield-alt", placeholder: "Privacy Search..." }
};
let currentEngine = 'bing';

function toggleEngineMenu() { document.getElementById('engine-options').classList.toggle('show'); }
function selectEngine(engineKey) {
    const engine = searchEngines[engineKey];
    if (!engine) return;
    currentEngine = engineKey;
    document.getElementById('current-engine-icon').className = engine.icon;
    document.getElementById('search-input').placeholder = engine.placeholder;
    toggleEngineMenu();
}
function doSearch() {
    const query = document.getElementById('search-input').value;
    if (query) window.open(searchEngines[currentEngine].url + encodeURIComponent(query), '_blank');
}
document.addEventListener('click', function(e) {
    const selector = document.getElementById('engine-selector');
    const menu = document.getElementById('engine-options');
    if (!selector.contains(e.target) && menu.classList.contains('show')) menu.classList.remove('show');
});
document.getElementById('search-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') doSearch(); });

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
    fetch('https://v1.hitokoto.cn/?c=a&c=b')
        .then(response => response.json())
        .then(data => { document.getElementById('hitokoto_text').innerText = `${data.hitokoto} —— ${data.from}`; })
        .catch(() => { document.getElementById('hitokoto_text').innerText = "System connected. Ready for input."; });
}

// 5. 天气 (已去除 ENV_STATUS 前缀)
function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');
    
    // 如果你想显示中文，可以加 &lang=zh，例如: https://wttr.in/?format=3&lang=zh
    // 这里保持默认，以匹配你刚才看到的 "Tai Kok Tsui" 格式
    fetch('https://wttr.in/?format=3')
        .then(response => response.text())
        .then(data => {
            // 【关键修改】直接显示数据，删除了 "ENV_STATUS: "
            statusDiv.innerText = data.trim();
        })
        .catch(() => {
            statusDiv.innerText = "Weather Offline";
        });
}

// 6. 音乐播放
function toggleMusic() {
    const audio = document.getElementById('bg-music');
    const widget = document.getElementById('music-widget');
    const btn = document.getElementById('play-btn');

    if (!audio.src || audio.src === window.location.href) {
        audio.src = "https://api.uomg.com/api/rand.music?sort=动漫&format=mp3";
    }

    if (audio.paused) {
        audio.play().catch(e => console.log("Auto-play blocked"));
        widget.classList.add('playing');
        btn.className = "fas fa-pause";
        widget.title = "正在播放随机动漫歌曲...";
    } else {
        audio.pause();
        widget.classList.remove('playing');
        btn.className = "fas fa-play";
        widget.title = "点击播放/暂停";
    }
}

// 初始化
setRandomBackground();
setInterval(updateClock, 1000);
updateClock();
fetchHitokoto();
fetchWeather();