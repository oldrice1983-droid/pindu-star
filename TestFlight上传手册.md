# 拼读星球 → iPhone 打包上传手册

工程已在你本地生成完毕。本手册只需在 **Mac** 上操作。

> 💡 **不想花 ¥688 也不想买 Mac？** 看另一份文档：**《免费侧载安装教程.md》** —— 用 GitHub Actions 云端 Mac 编译 + Sideloadly 侧载，全程免费，你在 Windows 上就能把 App 装进 iPhone。

---

## 0. 你需要先具备什么

| 前置条件 | 说明 |
|---|---|
| **一台 Mac**（macOS 13 以上） | **硬性要求**。iOS 安装包只能用 Xcode 编译，Windows 上无法产出 IPA |
| **Xcode 26 或更新** | Apple 自 2026-04-28 起要求：提交 App Store Connect 的包必须用 Xcode 26 + iOS 26 SDK 构建。Xcode 16 会被拒收 |
| **付费 Apple 开发者账号** | ¥688/年。TestFlight 挂在 App Store Connect 上，必须是付费会员，**没有免费途径** |
| 约 15 分钟 | 首次配置较慢，之后每次出包 3–5 分钟 |

> 若你只是自己手机上想用，**不必走 TestFlight**——用现有的「添加到主屏幕」方式完全免费且长期有效，见 `../start_ios.bat` 那一套。

---

## 1. 把工程拷到 Mac

工程目录：`english-phonics/ios-pack`

把**整个 `ios-pack` 文件夹**复制到 Mac 上（U 盘 / 隔空投送 / 网盘均可）。

```
ios-pack/
├── capacitor.config.json
├── package.json
├── www/                    ← 网页资源（源文件，改这里）
└── ios/                    ← Xcode 工程（Mac 上打开这个）
    ├── App/
    │   ├── App.xcodeproj
    │   ├── App.xcworkspace
    │   ├── App/
    │   │   ├── Info.plist          ← 已配好：中文名、1.0.0、arm64、无横屏
    │   │   ├── public/             ← 1731 个真人发音 mp3 已打包在此
    │   │   └── Assets.xcassets/    ← 已配好：1024 无透明通道图标
    │   └── Podfile
    └── App.xcworkspace
```

⚠️ **务必整个文件夹一起拷**，少了 `node_modules` 之外的任何文件都可能出问题。

---

## 2. Mac 上装依赖

打开「终端」（Terminal），`cd` 进 `ios-pack` 目录，执行：

```bash
# 1) 确认 Node.js 装了（没有就去 nodejs.org 下载 LTS 版）
node -v

# 2) 装依赖
npm install

# 3) 装 CocoaPods（Capacitor 的 iOS 依赖靠它）
sudo gem install cocoapods
pod --version
```

若 `pod --version` 报 `command not found`，Mac 上更推荐用 Homebrew：
```bash
brew install cocoapods
```

---

## 3. 打开 Xcode 工程

```bash
npx cap sync ios          # 再同步一次，确保资源齐全
open ios/App/App.xcworkspace
```

**注意开 `.xcworkspace`，不是 `.xcodeproj`**——区别就是 workspace 含 Pods。

---

## 4. 配置签名（最容易卡住的一步）

在 Xcode 左侧点最上面的蓝色 **App** 项目 → 顶部 **Signing & Capabilities** 标签页：

| 字段 | 填什么 |
|---|---|
| Team | 选你的付费开发者账号（若为空，点 `Add Account…` 用你的 Apple ID 登录，Xcode 会自动生成 Team） |
| Bundle Identifier | 改成**全球唯一**的，例如 `com.你的名字拼音.pindu`（默认是 `com.pinduxingqiu.app`，若已被占用会报错，改后缀即可） |
| Automatically manage signing | **必须勾上**（Xcode 自动管证书和描述文件） |

改完 Bundle Identifier 后，**同步改一下** `capacitor.config.json` 里的 `appId`（保持一致），再跑一次 `npx cap sync ios`。

### 如果勾 Team 后报错
- **"Signing for App requires a development team"** → Xcode 没登录账号：Xcode → Settings → Accounts → `+` → Apple ID 登录
- **"No matching provisioning profiles found"** → Bundle ID 已被别人占用，换一个
- **需要付费账号的报错** → 说明 Team 选成了免费的 Personal Team，在下拉里改选付费的那个

---

## 5. 选真机目标（别选模拟器）

Xcode 顶部工具栏，Scheme 选 **App**，右侧设备选 **Any iOS Device (arm64)** 或直接连上你的 iPhone。

⚠️ **不能选 iPhone 模拟器**——模拟器出的包不能上传。

---

## 6. Archive 打包

菜单栏 **Product → Archive**（或按 `⌘B` 后再 Archive）。

第一次会慢（要编译 Capacitor 原生代码），3–8 分钟正常。成功后 Xcode 自动打开 Organizer。

---

## 7. 上传到 App Store Connect

Organizer 窗口里：

1. 选中刚打好的包（右侧列表，注意版本号 `1.0.0 (1)`）
2. 点 **Validate App** 先做一次体检，有问题会列出来
3. 验证通过后点 **Distribute App**
4. 选 **App Store Connect** → **Upload**
5. 等待上传完成（38MB 音频 + 程序，通常 3–10 分钟）

---

## 8. 在 App Store Connect 里开测试

上传成功后，登录 [App Store Connect](https://appstoreconnect.apple.com)：

1. 进入 **我的 App** → **拼读星球**（首次可能要点 `+` 创建，填好名称、SKU、语言、Primary Category 选「教育」）
2. 左侧 **测试** → **iOS 构建版本**（TestFlight）
3. 点刚上传的 `1.0.0 (1)` 旁边的 **`+`** 加入测试
4. **内部测试**（Internal Testing）：
   - 无需审核，最快，**你自己的账号不用填邮箱就能直接装**
   - 在 **App Store Connect → 用户与访问 → 用户** 里把自己的 Apple ID 加为 App Store Connect 用户（角色选「Admin」或「Developer」）
   - 回到「内部测试」，创建测试组，把你自己加进去
5. 开启「**构建版本自动发布**」开关（省得每次手动批准）

> **先走内部测试**——不需要任何审核，是最快的验证路径。只有要给外人试才需要外部测试（首次要过 App Review）。

---

## 9. iPhone 上安装

iPhone 上：

1. App Store 搜 **TestFlight** 并安装（苹果官方 App，免费）
2. 打开 TestFlight，接受开发者邀请
   - 内部测试：**不用邀请**，直接在 TestFlight 里就能看到你的 App
3. 点 **安装**
4. 桌面上出现「🌱 拼读星球」图标，点开即全屏运行

---

## 10. 后续更新（改完网页内容后）

在 Mac 上：

```bash
# 1) 把新版的 index.html 等拷到 ios-pack/www/
# 2) 同步 + 打开 Xcode
npx cap sync ios
open ios/App/App.xcworkspace

# 3) Xcode 里改版本号（Signing & Capabilities → Build）
#    CFBundleShortVersionString 1.0.0 → 1.0.1
#    CFBundleVersion 1 → 2
# 4) Product → Archive → Distribute App → Upload
# 5) App Store Connect 里点新版本的 + 加入测试
```

⚠️ **每次上传必须递增 Build 号**，重复的 Build 号会被 Apple 直接拒收。

---

## 常见问题速查

| 现象 | 原因与解法 |
|---|---|
| `pod install` 报错 | 没装 CocoaPods。`brew install cocoapods` 后重跑 `npx cap sync ios` |
| Archive 按钮是灰的 | 设备选成了模拟器。改选 **Any iOS Device** |
| `No matching provisioning profiles` | Bundle ID 冲突，换一个唯一的 |
| 上传报 `Invalid Signature` | 证书过期。Xcode → Settings → Accounts → Manage Certificates，删掉旧证书重新生成 |
| 提示必须用 Xcode 26 | 按提示升级 Xcode 到 26+ 再打包 |
| TestFlight 里看不到 App | ① 确认构建版本已加进测试组；② 内部测试要先把 Apple ID 加为 App Store Connect 用户；③ 打开「自动发布」或手动批准 |
| 构建显示「过期」 | TestFlight 每个构建 **90 天**有效期，重新出包即可 |
| App 打开是白屏 | 跑一次 `npx cap sync ios`；或检查 `www/index.html` 是否损坏 |
| 发音不出声 | 检查手机没开静音键；App 内也有合成音兜底 |

---

## 关于你的「本地零上传」要求

这个 App **完全符合**你的红线：

- 学习记录、错题、进度全部存在手机 `localStorage`，**不经过任何服务器**
- App 不含任何网络请求代码，不上传、不统计、不连云
- 唯一的网络行为是你自己点「播放发音」时读**本地打包的 mp3 文件**（`capacitor://` 协议读 App 内资源，不出网）
- 源码里没有任何第三方 CDN 或统计脚本

也就是说：**装成 App 后比现在的网页版更符合零上传**——连局域网服务器都不需要了。
