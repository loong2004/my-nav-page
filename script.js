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
    document.getElementById('search-input').focus();
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
document.getElementById('search-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

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


// 5. 天气 (高德定位 -> 高德天气 -> 心知备用)
function fetchWeather() {
    const statusDiv = document.getElementById('weather-status');

    // 配置信息
    const amapConfig = {
        key: '02d4bd74cc1897fcb432cc2f77f15098',
        securityCode: 'fd70b506e58e5953e91efe72322b9aff',
        defaultCity: '320100' // 南京
    };

    // 备用：心知天气配置
    const seniverseConfig = {
        key: 'SBhWcvdeh-GwBOsHR',
        location: 'ip' // 心知也支持根据 IP 自动识别
    };

    function startWeatherSystem() {
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

    function runAmapLogic() {
        // 加载定位插件和天气插件
        AMap.plugin(['AMap.Geolocation', 'AMap.Weather'], function() {
            const geolocation = new AMap.Geolocation({
                enableHighAccuracy: false, // 纯前端 IP 定位不需要高精度
                timeout: 3000
            });
            const weather = new AMap.Weather();

            // 步骤 1: 获取当前城市定位
            geolocation.getCityInfo((status, result) => {
                let targetAdcode = amapConfig.defaultCity;
                
                if (status === 'complete' && result.adcode) {
                    targetAdcode = result.adcode;
                    console.log("定位成功:", result.city);
                } else {
                    console.warn("定位失败，使用默认城市(南京)");
                }

                // 步骤 2: 根据定位结果查询天气
                weather.getLive(targetAdcode, (err, data) => {
                    if (!err && data.info === 'OK') {
                        statusDiv.innerText = `${data.city}: ${data.weather} ${data.temperature}℃`;
                    } else {
                        trySeniverse();
                    }
                });
            });
        });
    }

    function trySeniverse() {
        const url = `https://api.seniverse.com/v3/weather/now.json?key=${seniverseConfig.key}&location=${seniverseConfig.location}&language=zh-Hans&unit=c`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results[0]) {
                    const res = data.results[0];
                    statusDiv.innerText = `${res.location.name}: ${res.now.text} ${res.now.temperature}℃`;
                }
            })
            .catch(() => { statusDiv.innerText = "Weather Offline"; });
    }

    startWeatherSystem();
}


// 6. 自动获取 GitHub Star 数
function fetchGithubStars() {
    fetch('https://api.github.com/repos/loong2004/my-nav-page')
        .then(response => response.json())
        .then(data => {
            if (data.stargazers_count !== undefined) {
                document.getElementById('github-star-count').innerText = data.stargazers_count;
            } else {
                document.getElementById('github-star-count').innerText = "-";
            }
        })
        .catch(err => {
            console.log("GitHub Star fetch failed:", err);
            document.getElementById('github-star-count').innerText = "-";
        });
}

// 初始化
setRandomBackground();
setInterval(updateClock, 1000);
updateClock();
fetchHitokoto();
fetchWeather();
fetchGithubStars();