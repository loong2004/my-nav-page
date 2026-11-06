# Loong's Terminal

> 赛博朋克风格个人导航页 · 纯静态 · 零框架

一个基于原生 HTML/CSS/JS 构建的极简导航终端,灵感源自《赛博朋克 2077》与黑客终端界面。

## 功能特性

- **多引擎搜索** - Google/Baidu/Bing/DuckDuckGo 快速切换,支持键盘操作
- **实时延迟监控** - 纯前端 RTT 测量,国内/国际分组,持续刷新 + SVG 折线图
- **智能天气** - 高德地图定位 + 天气(心知天气备用),自动切换
- **时钟问候** - 基于时段的动态问候语 + DS-Digital 数码时钟
- **GitHub 集成** - 实时 Star 数 + 贡献热力图
- **一言语录** - 随机经典句子
- **音乐播放器** - 网易云歌单解析,悬浮式深色皮肤
- **粒子动画** - 全息网格背景 + 霓虹光晕特效

## 配置指南

### 天气 API

编辑 `script.js` 中的配置:

```javascript
const amapConfig = {
    key: 'your_amap_key',
    securityCode: 'your_security_code',
    defaultCity: '320100'
};

const seniverseConfig = {
    key: 'your_seniverse_key',
    location: 'ip'
};
```

### 音乐歌单

编辑 `index.html` 中的歌单 ID:

```html
<meting-js server="netease" type="playlist" id="24381616" ...>
```

### 快捷导航

修改 `index.html` 中 `.cards-grid` 的链接和图标。

## 部署

推荐使用 Cloudflare Pages:

1. 推送代码到 GitHub
2. 在 Cloudflare 控制台连接仓库
3. Framework preset 选择 `None`
4. Build command 和 Output directory 留空

## 技术栈

- HTML5 / CSS3 / Vanilla JavaScript
- APlayer + MetingJS (音乐)
- FontAwesome (图标)
- 高德地图 API + 心知天气 API
- Hitokoto API (一言)

## 特点

- 无框架依赖,加载速度极快
- DNS Prefetch + 资源预加载优化
- 完整的响应式设计和无障碍支持
- 隐私保护:延迟测试无本站后端,referrerPolicy 防泄露

---

Made with 💻 by [Loong](https://github.com/loong2004)
