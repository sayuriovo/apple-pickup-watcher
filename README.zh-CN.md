# Apple Pickup Watcher

[English](README.md)

一个 Chrome 扩展，帮你盯着 Apple Store 门店的到店取货库存。你想要的 iPhone 一到货，手机马上收到推送；配合 Pushover 还能像闹钟一样把你叫醒。

## 它是怎么工作的

扩展运行在你自己的 Chrome 里，停在 Apple 官网的 iPhone 购买页上。它每隔几分钟查一次附近门店的取货库存，查询用的是你浏览器的真实登录状态，Apple 页面自己的脚本会自动续期 Cookie，所以不需要复制任何 Cookie，也不需要一直手动刷新。

发现有货后：

- **ntfy**：手机收到一条普通推送，写明哪家门店、哪个型号有货。
- **Pushover**（可选）：手机响起紧急闹铃，无视静音和勿扰模式，每 30 秒响一次，直到你在手机上点确认。

## 使用前请知道

- 这是非官方工具，依赖 Apple 官网未公开的接口。Apple 改版后可能失效。
- 查询太频繁会被 Apple 暂时限制（表现为状态码 541，连正常浏览官网都看不到取货信息）。默认 5 分钟一次，请不要调得太低。
- 购买页标签页必须一直开着，电脑不能睡眠。
- 目前只支持美国 Apple 官网的 iPhone 购买页。

---

## 第一步：安装扩展

1. 下载本项目并解压。在 GitHub 上点 **Code → Download ZIP**。解压出来的文件夹可能叫 `apple-pickup-watcher-main`，这是正常的。
2. Chrome 地址栏输入 `chrome://extensions` 回车。
3. 打开右上角的 **开发者模式**。
4. 点 **加载已解压的扩展程序**，选择解压出来的文件夹（里面能直接看到 `manifest.json` 的那一层）。

以后每次修改了文件，都要回到 `chrome://extensions`，点扩展卡片上的刷新按钮 ↻，再刷新 Apple 购买页，修改才会生效。

## 第二步：设置要监控的型号

打开 `main.js`，修改最上面的 `PARTS`。它是 Apple 内部的零件号，每个颜色、容量、版本都不一样。

**获取零件号：**

1. Chrome 打开 Apple 官网，进入 iPhone 购买页，选好型号、颜色、容量。
2. 按 **F12**（Mac 上按 Command + Option + I），切到 **网络（Network）** 标签。
3. 在过滤框输入 `fulfillment`，然后按 **F5** 刷新页面。
4. 点开出现的 `fulfillment-messages` 请求，在请求网址里找到 `parts.0=` 后面那串，比如 `MK1E4LL/A`。网址里如果显示成 `MK1E4LL%2FA`，其中 `%2F` 就是 `/`。
5. 想同时盯多个颜色或容量，就切换配置后重复一次。

填进 `main.js`：

```js
const PARTS = ["MK1E4LL/A", "MK1F4LL/A"];
```

## 第三步：设置门店范围

同样在 `main.js` 里修改 `CENTERS`：

```js
const CENTERS = [{ location: "10001" }, { location: "19103" }];
```

- 每个中心，Apple 会返回离它最近的 **12 家** 门店。
- 填一个你所在地的邮编就够用。想覆盖更远的门店，再加一个那边的邮编，结果会自动合并去重。
- 中心越多，每轮请求越多，被限制的风险越高。建议不超过 2 到 3 个。

## 第四步：设置手机通知

手机上需要一个推送通知类的 App 来接收提醒，有两种用途：

- **普通推送类**：有货时收到一条普通通知。
- **闹铃级提醒类**：静音或勿扰模式下也会响，可以把你叫醒。

原则上这两类 App 用哪个都行。扩展目前内置支持 **ntfy** 和 **Pushover**，所以本教程以这两个为例。想换成别的 App，需要修改 `background.js` 里的 `notify()` 函数。

### 方案 A：普通推送（以 ntfy 为例）

1. 手机安装 **ntfy**（iOS 在 App Store，Android 在 Google Play，搜 ntfy）。
2. 打开 App，点 **+** 订阅一个频道。频道名自己起，要长一点、难猜一点，比如 `iphone-alert-k7x29q`。
   ntfy 的频道是公开的，任何知道频道名的人都能看到消息，所以别用简单的名字。
3. 打开 `background.js`，填进频道名：
   ```js
   const NTFY_TOPIC = "iphone-alert-k7x29q";
   ```
4. **测试**：电脑终端（或命令提示符）运行下面这行，手机收到 test 就说明通了：
   ```
   curl -d "test" ntfy.sh/iphone-alert-k7x29q
   ```

### 方案 B：闹铃级提醒（以 Pushover 为例）

适合睡觉时也不想错过的情况。普通推送在静音或睡眠专注模式下不会响，Pushover 的紧急通知可以使用 iOS 的「关键提醒」，无视静音和勿扰模式。

Pushover 有免费试用期，之后需要在 App 内一次性购买，价格以应用商店为准。

1. **安装 App 并注册**：手机安装 **Pushover**，注册账号并登录。
2. **打开关键提醒（iOS）**：Pushover App → Settings → 打开 **Critical Alerts for high-priority**，系统弹窗点 **允许**。
   然后去 iPhone 的 设置 → 通知 → Pushover，确认 **允许通知**、**声音**、**关键提醒** 都是开着的。
3. **获取 User Key**：电脑登录 pushover.net，首页右侧 **Your User Key** 那一串就是。
4. **获取 API Token**：pushover.net 页面拉到最下面 → **Create an Application/API Token** → Name 随便填（比如 `apple-watcher`）→ 勾选同意条款 → **Create Application**。新页面顶部的 **API Token** 就是。
5. **填进 `background.js`**：
   ```js
   const PUSHOVER_TOKEN = "你的 API Token";
   const PUSHOVER_USER = "你的 User Key";
   ```
6. **在网页上先测一次**：pushover.net 首页左侧 Push a Notification，Priority 选 **Emergency**，发送。手机调成静音，应该照样会响，点开确认后停止。

**可选：换成更长的闹铃声**

Pushover 紧急通知最短 30 秒重复一次，自带提示音比较短，中间会有很长的安静时间。项目里附带了一段 30 秒的原创木琴闹铃 `alarm30.mp3`，上传后能做到接近连续响铃：

1. pushover.net 页面找到 **Your Custom Sounds**，上传 `alarm30.mp3`，名字填 `alarm30`。
2. 完全关掉手机上的 Pushover App 再重新打开，让它同步新铃声。
3. 修改 `background.js`：
   ```js
   const PUSHOVER_SOUND = "alarm30";
   ```

ntfy 和 Pushover 可以同时开：所有消息都会走 ntfy，只有「有货」这一种会额外触发 Pushover 闹铃。

### 运行状态提醒（自动开启，只需要 ntfy）

填了 ntfy 后，除了有货通知，你还会收到这些：

| 通知 | 什么时候发 |
|---|---|
| Apple watcher started | 打开购买页、第一次查询成功时 |
| Apple watcher still running | 每 12 小时一次，告诉你还在正常工作（可在 `background.js` 改 `HEARTBEAT_HOURS`） |
| Apple watcher stopped | 购买页标签页被关掉；或者浏览器开着，但连续一段时间（默认约 20 分钟）没有成功查询 |
| Apple watcher resumed | 中断后又恢复正常 |
| Apple watcher blocked | 连续 3 次被 Apple 拦截 |

**ntfy 的额度：** ntfy.sh 对免费用户有速率限制，具体数字以官网为准。这个扩展正常情况下每天只发几条，不会碰到限制。

### 可选：浏览器关闭、电脑睡眠、断网时也能收到提醒（Healthchecks.io）

浏览器整个关掉、电脑睡眠或者断网时，扩展自己也停了，没办法发通知。这种情况要靠一个外部服务：扩展每次查询成功就去 Healthchecks.io 打一次卡，超过设定时间没打卡，Healthchecks.io 就通过 ntfy 通知你。Healthchecks.io 是 ntfy 官方列出的集成之一，个人使用免费。

1. 打开 healthchecks.io，注册并登录。
2. 点 **Add Check** 创建一个检查，名字随便填，比如 `apple-watcher`。
3. 修改时间设置（Change Schedule 或 Period / Grace 设置）：
   - **Period** 设为 `5 minutes`（和 `main.js` 里的 `INTERVAL_MIN` 一样）
   - **Grace** 设为 `15 minutes`
4. 复制这个检查的 **Ping URL**，形如 `https://hc-ping.com/xxxxxxxx-xxxx-...`。
5. 打开左上角项目里的 **Integrations**，找到 **ntfy**，点 **Add Integration**：
   - Topic 填你的 ntfy 频道名
   - Server 保持 `https://ntfy.sh`
   - 保存
6. 回到刚才的检查页面，确认 Notifications 一栏里 ntfy 是开启状态。
7. 填进 `background.js`：
   ```js
   const HEALTHCHECK_URL = "https://hc-ping.com/你的那一串";
   ```

之后电脑断网或睡眠超过约 20 分钟，你会收到 Healthchecks.io 发来的 “down” 通知；恢复后会收到 “up” 通知。Healthchecks.io 也支持 Pushover，想让离线提醒也响铃，可以在 Integrations 里加 Pushover。

## 第五步：启动和测试

1. 改完文件后，到 `chrome://extensions` 点刷新按钮 ↻。
2. 打开第二步里那个 Apple iPhone 购买页。
3. 等大约 20 秒：
   - 标签页标题前面出现 `[No stock 01:04:36]` 这样的状态，说明查询成功。
   - 手机收到「Watcher started. Checking N stores.」
4. **测试有货通知**：在 **Apple 购买页** 上按 F12 → 控制台（Console），粘贴下面这行回车：
   ```js
   window.postMessage({__asw:true,title:"iPhone in stock",msg:"test"},"*")
   ```
   如果 Chrome 提示不允许粘贴，先按提示输入 `allow pasting` 回车，再粘贴。
   正常情况下 ntfy 收到 test，Pushover 开始响铃。
   注意要在 Apple 购买页的控制台里运行，在其他网页里运行不会有任何反应。

## 第六步：保持运行（必须设置）

电脑睡眠或者 Chrome 让标签页休眠，检测就会停止。放着运行之前，先设置好这两项。

**1. 防止电脑睡眠**

- **Mac**：系统设置 → 电池 → 选项 → 打开 **“使用电源适配器供电且显示器关闭时，防止自动进入睡眠”**。保持插电，MacBook 要开着盖子。
- **Windows**：设置 → 系统 → 电源（或“电源和电池”）→ 屏幕和睡眠 → 把插电时的睡眠时间改成 **从不**。

屏幕熄灭没关系。

**2. 防止 Chrome 让标签页休眠**

Chrome 设置 → 性能 → 在 **“始终让以下网站保持活跃状态”** 旁边点 **添加**，输入 `apple.com`。也可以直接关掉省内存模式。

## 日常使用

- 购买页标签页一直开着，别关，也别在里面跳转到别的页面。建议单独放一个 Chrome 窗口，最小化。
- 页面每 15 分钟会自动刷新一次，这是正常的。
- 收到有货通知后尽快下单，热门配置通常几分钟就会被抢完。

## 常见问题

**我的 iPhone 在静音状态下可以收到闹铃通知吗？**
可以，前提是按方案 B 设置了 Pushover 并打开了关键提醒。iPhone 处于系统默认的睡眠专注模式时，也可以收到闹铃通知。

**怎么确认自己有没有被 Apple 限制访问？**
用 Chrome 正常打开 iPhone 购买页，看 **Add to Bag** 按钮上方。如果同时显示 **Delivers to ...**（配送）和 **Pickup: ...**（取货）两行信息，就说明一切正常。如果这两行都没有，只剩一个 Add to Bag 按钮，说明你的电脑或网络被 Apple 暂时限制了，先停用扩展，过一段时间再试。

**标签页标题显示 `[Blocked ...]` 怎么办？**
扩展会在 1 分钟后自动刷新页面重试，连续 3 次失败会推送提醒。如果一直这样，先停用扩展。然后按上一个问题的方法检查是否被 Apple 限制。如果被限制了，只能等一段时间再试。恢复后把 `INTERVAL_MIN` 调大一些。

**标题一直没变化？**
确认修改文件后点了扩展的刷新按钮，并刷新了购买页。在购买页按 F12 → 控制台，看有没有 `[Apple Watcher]` 开头的日志，如果显示「No part numbers set」，检查 `main.js` 里的 `PARTS`。

**ntfy 收得到，Pushover 没反应？**
在 `chrome://extensions` 点扩展卡片上的 **Service Worker** 链接，打开后台控制台，再运行一次测试命令，看 `pushover` 开头那行返回什么。返回里 `"status":1` 表示发送成功；如果提示 token 或 user 无效，检查是否复制错了字符。

**Pushover 有通知但没声音？**
检查第四步方案 B 的第 2 点，关键提醒权限是否打开。

**分享给朋友前要做什么？**
把 `background.js` 里你自己的 ntfy 频道名和 Pushover 密钥删掉。别人拿到你的密钥就能给你的手机发通知。

## 联系方式

有问题可以发邮件到 jefftsuei217@gmail.com。我看邮箱不太频繁，但看到的邮件都会回复。

## 免责声明

本项目仅供个人学习使用，与 Apple 无关。使用时请遵守 Apple 网站的使用条款，并控制查询频率。

如果本项目违反了 Apple 的条款或侵犯了任何权益，请发邮件到 jefftsuei217@gmail.com 联系我，我会将其删除。
