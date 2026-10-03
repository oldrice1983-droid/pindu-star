# 部署到 GitHub Pages · 一次推送，永久网址

完成后你在任何地方、任何网络用 iPhone 打开这个 App，**不用开电脑**。

---

## 第 1 步 · 推送代码（唯一需要你操作的电脑动作）

双击：

```
C:\Users\fm520\WorkBuddy\2026-10-01-01-17-06\english-phonics\ios-pack\GO-push.bat
```

凭据已缓存，应该几秒推完。

---

## 第 2 步 · 开启 Pages（网页上点两下）

打开：**https://github.com/oldrice1983-droid/pindu-star/settings/pages**

在 **Build and deployment** 区域：

| 字段 | 选什么 |
|---|---|
| Source | **Deploy from a branch** |
| Branch | **main** |
| Folder | **/ (root)** |

点 **Save**

> Folder 必须是 `/ (root)`，别选 `/docs`。

---

## 第 3 步 · 推一次就自动发布

再双击一次 `GO-push.bat`（或者上一步推送时它已经触发了）。

工作流名：**「发布到 GitHub Pages」**

它会自动把 `www/` 目录发布出去。等 **2–4 分钟**（38MB 音频要上传）。

---

## 第 4 步 · 拿到网址

回到 **Settings → Pages**，页面顶部会出现：

```
Your site is live at
https://oldrice1983-droid.github.io/pindu-star/
```

**这个网址就是永久地址**，全球任何网络都能开。

---

## 第 5 步 · iPhone 上装

1. 用 **Safari** 打开那个网址（⚠️ 必须 Safari，Chrome 不行）
2. 点底部**分享** → **添加到主屏幕**
3. 桌面上出现「🌱 拼读星球」图标

**从此随时可用** —— 不开电脑、不要证书、不用每周续签。

---

## 以后改了内容怎么办

```bash
# 改完 www/ 里的文件后
cd english-phonics/ios-pack
git add -A
git commit -m "更新内容"
git push
```

推送后工作流自动重新发布，**网址不变**，iPhone 刷新即可。

---

## 隐私说明

| 问题 | 答案 |
|---|---|
| 学习记录会上传吗？ | **不会**。答题记录存手机 localStorage，GitHub 只托管静态文件 |
| App 运行时会联网吗？ | 首次打开下载文件，之后走本地缓存 |
| 源码公开吗？ | 是。你已确认拼读星球不涉密，这条红线不适用它 |

---

## 可能的问题

**Pages 一直显示 "Your site is live" 但打开 404**
→ 去看 **Actions** 里「发布到 GitHub Pages」是否成功。如果是第一次没触发，去 Actions 页面点 **Run workflow** 手动跑一次。

**页面打开但没声音**
→ 音频还在上传。等几分钟刷新页面。

**iPhone 上「添加到主屏幕」是灰的**
→ 必须用 **Safari**。Chrome、微信内置浏览器都不支持。

**想离线用**
→ 打开一次让它完整加载，之后断网也能用（Service Worker 已内置）。

---

## 备选方案：Cloudflare Tunnel（文件不过第三方）

如果你不想公开源码，可以让电脑开个隧道：

```bash
# 需先装 cloudflared：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8123
```

它会给一个临时公网网址，**文件不经过任何第三方服务器**。

代价：**电脑必须开着**，人不在家就断。
