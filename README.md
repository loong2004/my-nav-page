
# 🌌 Loong's Terminal | 个人赛博指挥中心

> A Cyberpunk-styled Personal Dashboard / Startpage.
> 极简、硬核、纯静态的个人导航页。

![Project Demo](https://pic.soomin.de5.net/api/rfile/demo.png)

## ⚡ 简介 (Introduction)

这是一个基于 **HTML5, CSS3, Vanilla JS** 构建的个人导航终端。它摒弃了繁杂的框架，追求极致的加载速度与视觉体验。

设计灵感源自《赛博朋克 2077》与黑客终端界面，集成了**全自动天气监测**、**网易云音乐播放器**、**GitHub 战术热力图**以及**多引擎搜索**功能。全站资源经过深度优化，支持 Cloudflare 秒级分发。

## 🛠️ 核心特性 (Features)

* **🎨 赛博视觉 (Cyberpunk UI)**
    * 全息网格背景 + 霓虹玻璃拟态设计。
    * 集成 `DS-Digital` 数码字体，还原复古终端时钟。
    * 动态随机二次元壁纸（防缓存优化）。
* **🎵 核弹级音乐播放器 (APlayer + MetingJS)**
    * 左下角悬浮式战术播放器，深度定制的深色磨砂皮肤。
    * 直接解析 **网易云音乐** 歌单 ID，全自动获取封面、歌词、列表。
    * 支持吸底模式、随机播放、列表折叠。
* **🌦️ 环境监测 (Environment Monitor)**
    * 通过 `wttr.in` 接口获取实时天气。
    * **已锁定坐标**：南京 (Nanjing)，数据格式化为终端风格。
* **💻 战术面板 (Tactical Dashboard)**
    * **GitHub Activity**：集成 `ghchart`，青色 (Cyan) 滤镜渲染提交热力图。
    * **Smart Search**：集成 Google, Baidu, Bing, DuckDuckGo，支持快捷键切换与自动聚焦。
    * **Time-based Greeting**：根据当前时间自动切换问候语（早安/晚安/修仙中）。
* **🚀 极致性能 (Performance)**
    * `DNS-Prefetch` & `Preconnect` 预连接关键 CDN。
    * 所有第三方库（FontAwesome, APlayer）均走国内高速 CDN 镜像。
    * 链接添加 `rel="noopener noreferrer"` 安全属性。

## 📂 项目结构 (Structure)

```text
.
├── index.html      # 核心骨架 (包含 APlayer 配置与 CDN 引用)
├── style.css       # 视觉样式 (包含霓虹特效与播放器皮肤)
├── script.js       # 战术逻辑 (天气、时间、搜索、交互)
├── DS-DIGI.TTF     # 本地化数码字体文件
├── avatar.jpg      # 个人头像
└── README.md       # 说明文档

```

## ⚙️ 个性化配置 (Configuration)

### 1. 修改音乐歌单

打开 `index.html`，找到 `<meting-js>` 标签，修改 `id` 属性：

```html
<meting-js server="netease" type="playlist" id="24381616" ... >

```

### 2. 修改天气城市

打开 `script.js`，找到 `fetchWeather` 函数：

```javascript
// 把 Nanjing 换成你的城市拼音 (例如 Beijing, Shanghai)
fetch('[https://wttr.in/Nanjing?format=%l:+%c+%t&lang=zh](https://wttr.in/Nanjing?format=%l:+%c+%t&lang=zh)')

```

### 3. 修改链接与卡片

打开 `index.html`，在 `<div class="cards-grid">` 区域内修改 `<a>` 标签的 `href` 和文本即可。

---

## 🚀 部署指南 (Deployment)

本项目是纯静态页面，推荐托管在 **Cloudflare Pages**，既免费又快，还能自动通过 Git 更新。

### 第一步：推送到 GitHub

1. 在 GitHub 上新建一个仓库（Repository），例如命名为 `my-terminal`。
2. 将本地代码推送到该仓库：
```bash
git init
git add .
git commit -m "Initial commit: Cyberpunk Terminal Ready"
git branch -M main
git remote add origin [https://github.com/你的用户名/my-terminal.git](https://github.com/你的用户名/my-terminal.git)
git push -u origin main

```



### 第二步：托管到 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单点击 **"Workers & Pages"** (Workers 和 Pages)。
3. 点击 **"Create application"** (创建应用程序) -> 选择 **"Pages"** 标签页 -> 点击 **"Connect to Git"** (连接到 Git)。
4. 授权你的 GitHub 账号，并选择刚才创建的 `my-terminal` 仓库。
5. **配置构建设置**：
* **Project name**: 随便填（例如 `loong-terminal`）。
* **Framework preset**: 选择 `None` (因为我们是纯静态 HTML/JS)。
* **Build command**: 留空。
* **Build output directory**: 留空 (或者填 `/`，通常留空即可)。


6. 点击 **"Save and Deploy"** (保存并部署)。

等待几秒钟，Cloudflare 会给你一个类似 `https://loong-terminal.pages.dev` 的二级域名，此时你的网站已经上线了！🎉

### 第三步：绑定个人域名 (Custom Domain)

如果你拥有自己的域名（例如 `loong.com`），可以将其绑定到这个页面。

1. 在 Cloudflare Pages 的项目页面中，点击顶部的 **"Custom domains"** (自定义域) 标签。
2. 点击 **"Set up a custom domain"** (设置自定义域)。
3. 输入你想用的子域名，例如 `nav.loong.com`，点击 **"Continue"**。
4. **DNS 设置**：
* **如果你的域名已经托管在 Cloudflare**：它会自动提示你添加一条 CNAME 记录，点击 **"Activate domain"** 即可全自动完成。
* **如果你的域名在阿里云/腾讯云**：它会提示你手动去你的域名注册商那里添加一条 `CNAME` 记录，指向 Cloudflare 提供的地址（例如 `loong-terminal.pages.dev`）。


5. 等待几分钟 DNS 生效，访问你的个人域名即可！

---

## 🤝 Credits

* **Fonts**: LXGW WenKai Screen / DS-Digital
* **Icons**: FontAwesome 6
* **Music**: APlayer & MetingJS
* **Wallpaper**: Paul API
* **Weather**: wttr.in
* **Charts**: ghchart

---

<p align="center">
System Status: <span style="color: #06b6d4">ONLINE</span> |
Made with 💻 by <a href="https://github.com/loong2004">Loong</a>
</p>
