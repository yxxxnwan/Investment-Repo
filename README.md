# 投资罗盘 · iPhone 本地版（PWA）

## 这是什么？
这是一个可加入 iPhone 主屏幕的 Progressive Web App（PWA），不是 App Store 的原生 `.ipa`。安装后有独立图标、全屏显示和离线账本。**账户明细、交易和成本保存在当前 iPhone 的网站存储（localStorage），不会自动上传到托管网站。** 首次安装需要 HTTPS 网站，之后已缓存页面可离线打开。

## 第一次安装（不需要 Mac / Apple 开发者账号）
1. 解压下载包，找到 `site` 文件夹。**只公开上传 `site` 文件夹里的文件；不要上传私人初始数据 JSON**。
2. 找一个 HTTPS 静态网站托管（例如 GitHub Pages、Cloudflare Pages 或 Netlify）。用 GitHub Pages 的一种方式：在 GitHub 建立一个新仓库，上传 `site` 内的全部文件到仓库根目录，然后在 `Settings → Pages → Build and deployment` 选择 `Deploy from a branch`、`main`、`/(root)` 并保存。
3. 等 GitHub Pages 页面给出网址，例如 `https://你的GitHub用户名.github.io/你的仓库名/`。用 **iPhone Safari** 打开该地址，确认应用可以加载。
4. 在 Safari 点击“分享”图标（方框向上箭头）→ **加入主屏幕 (Add to Home Screen)** → 添加。如显示 `Open as Web App` 则保持开启。
5. 从 iPhone 主屏幕点击“投资罗盘”图标打开。第一次成功加载后，主要界面和手动记录功能可离线使用。

> **重要：** ZIP 文件不能直接在 iOS 上安装为原生 App。把 `index.html` 放在“文件”App 里也不能保证 iOS 允许作为 PWA 安装或正常持久保存数据。HTTPS 部署是最稳定的安装方式。GitHub Pages 会公开源码，但 `site` 目录不含私人持仓。私人数据只从手机导入。

## 导入已有投资信息
我们另附了一份单独的 `投资罗盘_个人初始数据_仅私下导入.json`，不在公开 `site` 目录内。请先把这个 JSON 私人保存到 iPhone 的“文件”App，再在投资罗盘 → **设置** → **导入 JSON 备份**，选择文件。初始数据包括 9 股 VWRA、11 股 SPYL、DBS SRS 的 S$15,300 入金及尚未确认份额的 MSCI World 订单，不会虚构买入成本。该操作会覆盖当前 App 账本。

首次使用请核对 IBKR 现金余额、实际成交价格与成本，POEMS 的基金 Units / 实际 SRS 扣款，再勾选“历史流水完整”。资金入金不要与买基金的转账重复算成本。

## 自动 ETF 报价（可选）
**离线时无法取得新的证券市场价格。** 默认支持手动输入最新价格和 NAV；可选使用在线行情代理为上市 ETF 获取公开行情。POEMS 的部分 Amundi 单位信托没有可靠的公共自动 NAV 接口，需要手动填写。

如果想配置联网自动报价：
1. 在 Cloudflare 免费账户新建一个 Worker（Workers & Pages → Create → Worker）。
2. 把本包的 `optional_quote_worker.js` 代码粘贴部署，获取 HTTPS `https://xxxx.workers.dev` 地址。
3. 在投资罗盘 → **设置 → ETF 行情代理 HTTPS 地址** 中填这个地址，点击“保存并检测行情连接”。如果检测成功，回到总览点击“更新报价”。
4. 如果 Cloudflare Worker 无法访问 Yahoo Finance，系统会保留手动/缓存价格，并标记旧报价。第三方行情接口可能出现延迟、停用、配额限制或价格币种不符。

行情代理只接收你要查询的证券代码，不会接收持仓份额或交易记录。不建议向任何不可信的行情代理发送账户信息；本应用不会这样做。

## 非常重要：备份与数据安全
- 每次更新后，建议在 **设置 → 导出 JSON 备份**，把文件存到“文件”App / iCloud Drive 私人位置。
- 删除主屏幕应用、在 iPhone 设置里清除网站数据、低存储空间被系统回收或更换手机，都可能导致本机账本丢失；请务必另存备份。
- 备份 JSON 包含你的个人资产数据，不要上传到公开 GitHub 仓库，也不要发给陌生人。
- App 不能直接连接或操作 IBKR、DBS 或 POEMS，不会自动读取真实持仓、成交和入金记录；请自己核对。
- 自动行情并非实时交易价格，不应用作单独的交易执行依据。

## 修改 / 重新发布
网页源码在 `site/index.html`、`site/app.js`、`site/style.css`。改完上传更新相应文件即可。为了触发离线缓存刷新，记得修改 `site/sw.js` 第一行的 `investment-compass-ios-v1` 版本号；更新网站后重新打开 iPhone App。

## 如果你想要真正原生的 `.ipa`
那是另一种开发方式：需要用 macOS + Xcode 构建并签名，通过受支持的安装渠道安装到 iPhone。当前这个版本是无需 Apple 开发者账号、无需上架 App Store、可本地离线保存数据的 PWA。