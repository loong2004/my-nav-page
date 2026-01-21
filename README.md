# 🌌 Loong's Terminal | 个人赛博指挥中心

> A Cyberpunk-styled Personal Dashboard / Startpage.
> 极简、硬核、纯静态的个人导航页。

![Project Demo](https://pic.soomin.de5.net/api/rfile/demo.png)

## ⚡ 简介 (Introduction)

这是一个基于 **HTML5, CSS3, Vanilla JS** 构建的个人导航终端。它摒弃了繁杂的框架，追求极致的加载速度与视觉体验。

设计灵感源自《赛博朋克 2077》与黑客终端界面，集成了**智能地理位置感知**、**多路天气监测**、**网易云音乐播放器**、**GitHub 活动热力图**、**网络状态实时监控**、**多引擎搜索**以及**一言随机语录**功能。

## 🛠️ 核心特性 (Features)

* **🎨 赛博视觉 (Cyberpunk UI)**
    * 全息网格背景 + 霓虹玻璃拟态设计
    * 集成 `DS-Digital` 数码字体，还原复古终端时钟
    * 动态流光跑马灯卡片特效
    * 预加载动画，视觉过渡更丝滑
* **📝 一言语录 (Hitokoto)**
    * 集成一言 API，随机展示经典语句
    * 自动获取语句来源
* **🎵 核弹级音乐播放器 (APlayer + MetingJS)**
    * 左下角悬浮式战术播放器，深度定制的深色磨砂皮肤
    * 直接解析 **网易云音乐** 歌单 ID，全自动获取封面、歌词、列表
    * 支持随机播放、列表展开/折叠
* **🌦️ 环境监测 (Environment Monitor)**
    * **智能定位**：基于高德地图 JS API 的 IP 定位技术，自动识别访问者城市信息
    * **双路解析**：优先调用高德实时天气插件；若高德接口异常，自动无缝切换至心知天气 (Seniverse) 作为备用源
    * **安全加固**：原生支持高德 JS API 安全密钥（SecurityJsCode）校验
* **💻 战术面板 (Tactical Dashboard)**
    * **GitHub Activity**：集成 `ghchart` 渲染提交热力图
    * **GitHub Star**：右上角实时显示项目 Star 数量
    * **Smart Search**：集成 Google, Baidu, Bing, DuckDuckGo，支持点击切换引擎与 Tab/Enter 快捷键
    * **Time-based Greeting**：根据当前系统时间自动切换问候语
    * **Quick Links**：快捷导航卡片（博客、影院、图床、热点）
    * **Network Monitor**：实时监控多站点（字节、B站、微信、淘宝、GitHub、jsDelivr、Cloudflare、YouTube）连通性，带信号灯可视化
* **🚀 极致性能 (Performance)**
    * `DNS-Prefetch` & `Preconnect` 预连接高德、GitHub 等关键 API 域名
    * 所有第三方库均走国内高速 CDN 镜像
    * 资源预加载优化，300ms 极速启动

## 📂 项目结构 (Structure)

```text
.
├── index.html      # 核心骨架 (包含 APlayer 配置与页面结构)
├── style.css       # 视觉样式 (包含霓虹特效、播放器皮肤、动画)
├── script.js       # 战术逻辑 (定位、天气、搜索、时钟、网络监控)
├── DS-DIGI.TTF     # 本地化数码字体文件
├── avatar.jpg      # 个人头像
└── README.md       # 说明文档
```

## ⚙️ 个性化配置 (Configuration)

### 1. 修改高德天气/定位 Key

打开 `script.js`，找到 `amapConfig` 对象。请确保您的 Key 类型为 **Web端(JS API)**：

```javascript
const amapConfig = {
    key: 'xxx',        // 您的 Key
    securityCode: 'xxx', // 您的安全密钥
    defaultCity: '320100' // 定位失败时的兜底城市编码 (南京)
};
```

### 2. 修改心知天气 (备用)

若需修改备用源配置，请在 `script.js` 中更新 `seniverseConfig`：

```javascript
const seniverseConfig = {
    key: 'xxx', // 心知天气私钥
    location: 'ip'            // 自动识别位置
};
```

### 3. 修改音乐歌单

在 `index.html` 中，修改 `<meting-js>` 标签的 `id`（网易云歌单 ID）：

```html
<meting-js server="netease" type="playlist" id="24381616" ... >
```

### 4. 修改快捷导航卡片

在 `index.html` 中，修改 `.cards-grid` 内的链接：

```html
<div class="cards-grid">
    <a href="https://your-blog.com" target="_blank" class="card">
        <div class="icon"><i class="fas fa-rss"></i></div>
        <div class="info"><h3>个人博客</h3><p>BLOG LINK</p></div>
    </a>
    ...
</div>
```

## 🚀 部署指南 (Deployment)

本项目推荐托管在 **Cloudflare Pages**。

1. **推送代码**：将代码推送到 GitHub 仓库
2. **连接 Pages**：在 Cloudflare 控制台选择该仓库，Framework preset 选择 `None`
3. **完成部署**：Build command 与 Output directory 留空，保存即可上线

---

## 🤝 Credits

* **Weather**: [Amap API](https://lbs.amap.com/) & [Seniverse](https://www.seniverse.com/)
* **Fonts**: LXGW WenKai Screen / DS-Digital / JetBrains Mono
* **Icons**: FontAwesome 6
* **Music**: APlayer & MetingJS
* **Wallpaper**: Unsplash
* **Charts**: ghchart
* **Hitokoto**: [Hitokoto](https://hitokoto.cn/)

---

<p align="center">
System Status: <span style="color: #06b6d4">ONLINE</span> |
Made with 💻 by <a href="https://github.com/loong2004">Loong</a>
</p>
