# Apple Pickup Watcher

[English](README.md)

一个 Chrome 扩展，帮你盯着 Apple Store 门店的到店取货库存。你想要的 iPhone 一到货，手机马上收到推送；配合 Pushover 还能像闹钟一样把你叫醒。

## 它是怎么工作的

扩展运行在你自己的 Chrome 里，停在 Apple 官网的 iPhone 购买页上。它每隔几分钟查一次附近门店的取货库存，查询用的是你浏览器的真实登录状态，Apple 页面自己的脚本会自动续期 Cookie，所以不需要复制任何 Cookie，也不需要一直手动刷新。

发现有货后：

- **ntfy**：手机收到一条普通推送，写明哪家门店、哪个型号有货。
- **Pushover**（可选）：手机响起紧急闹铃，无视静音和勿扰模式，每 30 秒响一次，直到你在手机上点确认。

## 使用前请知道

- 这是非官方工具，依赖 Apple 官网未公开的接口，Apple 改版后可能失效。每次检查都先用 `/shop/retail/pickup-message`，只有新接口返回异常内容时，才会临时试一次旧接口 `/shop/fulfillment-messages`。如果是被 Apple 限制（状态码 541），它会直接等待，不会再多发一个请求去试旧接口。
- 查询太频繁会被 Apple 暂时限制（表现为状态码 541，连正常浏览官网都看不到取货信息）。默认大约 10 分钟一次，间隔随机。作者实测用一个查询中心、大约每 5 分钟一次，连续跑了约两天，只偶尔被拦截。不建议低于 5 分钟。
- Chrome 要一直开着，电脑不能睡眠。购买页标签页被关掉或者 Chrome 重启后，扩展会自动重新打开它。
- 目前只支持美国 Apple 官网的 iPhone 购买页。

---

## 第一步：安装扩展

1. 下载本项目并解压。在 GitHub 上点 **Code → Download ZIP**。解压出来的文件夹可能叫 `apple-pickupstock-watcher-main`，这是正常的。
2. Chrome 地址栏输入 `chrome://extensions` 回车。
3. 打开右上角的 **开发者模式**。
4. 点 **加载已解压的扩展程序**，选择解压出来的文件夹（里面能直接看到 `manifest.json` 的那一层）。

以后每次修改了文件，都要回到 `chrome://extensions`，点扩展卡片上的刷新按钮 ↻，再刷新 Apple 购买页，修改才会生效。

## 第二步：设置要监控的型号

打开 `main.js`，修改最上面的 `PARTS`。它是 Apple 内部的零件号，每个颜色、容量、版本都不一样。

**获取零件号：**

1. Chrome 打开 Apple 官网，进入 iPhone 购买页，选好型号、颜色、容量。
2. 按 **F12**（Mac 上按 Command + Option + I），切到 **网络（Network）** 标签。
3. 在过滤框输入 `fulfillment`，然后按 **F5** 刷新页面。如果什么都没出现，换成输入 `pickup-message` 试试。
4. 点开出现的 `fulfillment-messages`（或 `pickup-message`）请求，在请求网址里找到 `parts.0=` 后面那串，比如 `MK1E4LL/A`。网址里如果显示成 `MK1E4LL%2FA`，其中 `%2F` 就是 `/`。
5. 想同时盯多个颜色或容量，就切换配置后重复一次。

填进 `main.js`：

```js
const PARTS = ["MK1E4LL/A", "MK1F4LL/A"];
```

## 第三步：设置门店范围

同样在 `main.js` 里修改 `CENTERS`：

```js
const CENTERS = [{ location: "10001" }];
```

- 每个中心，Apple 会返回离它最近的 **12 家** 门店。
- 每个中心每次检查要发一个请求，所以**建议只用一个中心**。
- 想同时覆盖两个地区，可以先试一个位于两地中间的邮编。启动时收到的 “Watcher started” 通知里会写覆盖了几家门店，在购买页按 F12 打开控制台，`[Apple Watcher] ... Stores:` 开头的那一行会列出具体是哪些店。
- 也可以加多个中心，比如 `[{ location: "10001" }, { location: "19103" }]`，结果会自动合并去重，但每多一个中心就多一个请求，更容易被限制。

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
| Apple watcher stopped | 连续一段时间（默认约 35 分钟）没有成功查询，并且自动刷新页面也没修好 |
| Apple watcher resumed | 中断后又恢复正常 |
| Apple watcher blocked | 连续 3 次被 Apple 拦截（之后会降低频率继续重试） |

**ntfy 的额度：** ntfy.sh 对免费用户有速率限制，具体数字以官网为准。这个扩展正常情况下每天只发几条，不会碰到限制。

### 可选：浏览器关闭、电脑睡眠、断网时也能收到提醒（Healthchecks.io）

浏览器整个关掉、电脑睡眠或者断网时，扩展自己也停了，没办法发通知。这种情况要靠一个外部服务：扩展每次查询成功就去 Healthchecks.io 打一次卡，超过设定时间没打卡，Healthchecks.io 就通过 ntfy 通知你。Healthchecks.io 是 ntfy 官方列出的集成之一，个人使用免费。

1. 打开 healthchecks.io，注册并登录。
2. 点 **Add Check** 创建一个检查，名字随便填，比如 `apple-watcher`。
3. 修改时间设置（Change Schedule 或 Period / Grace 设置）：
   - **Period** 设为 `10 minutes`（和 `main.js` 里的 `INTERVAL_MIN` 一样）
   - **Grace** 设为 `20 minutes`
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

之后电脑断网或睡眠超过约 30 分钟，你会收到 Healthchecks.io 发来的 “down” 通知；恢复后会收到 “up” 通知。Healthchecks.io 也支持 Pushover，想让离线提醒也响铃，可以在 Integrations 里加 Pushover。

## 第五步：启动和测试

1. 改完文件后，到 `chrome://extensions` 点刷新按钮 ↻。
2. 打开第二步里那个 Apple iPhone 购买页。
3. 等大约 20 秒：
   - 标签页标题前面出现 `[No stock 01:04:36]` 这样的状态，说明查询成功。
   - 手机收到「Watcher started. Checking N stores (endpoint: pickup).」。`pickup` 表示新接口可用，`fulfillment` 表示用的是旧接口。
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

- 购买页标签页放着别动就行，建议单独放一个 Chrome 窗口并最小化。不小心关掉了，扩展会在后台重新打开。
- **想停止检测，请在 `chrome://extensions` 把扩展关掉。** 只关标签页没用，它会被重新打开。
- 扩展大约每 10 分钟检查一次，页面大约每小时自动刷新一次（如果用的是旧接口，大约每 20 分钟），具体时间是故意随机的。
- 检测停了一段时间，扩展会先自己刷新或重新打开一次页面，修不好才通知你。
- 你可以另开一个 Apple 购买页标签页正常购物。同一时间只有一个购买页标签页负责检测，不会增加请求。
- 收到有货通知后点一下就能打开购买页，尽快下单，热门配置通常几分钟就会被抢完。提前在 Apple Store App 里登录并保存好付款方式，能省不少时间。

## 补货历史

扩展会记录每家门店、每个型号什么时候开始有货、什么时候卖完。点 Chrome 工具栏上的扩展图标就能打开。如果工具栏上看不到图标，点拼图图标把 Apple Pickup Watcher 固定出来。也可以在扩展的 **详情 → 扩展程序选项** 里打开。页面内容包括：

- 按一天中每个小时统计的补货次数图，能看出附近门店一般几点补货；
- 每次补货的明细表：门店、零件号、开始有货时间、卖完时间、持续了多久；
- 导出 CSV 和清空记录的按钮。

记录只保存在你自己的浏览器里，不会发送到任何地方。只有扩展在运行、没被限制的时间段才会有记录。

## 设置一览

所有设置都在两个文件顶部 “edit this part only” 的区块里。

**`main.js`**

| 设置 | 默认值 | 作用 |
|---|---|---|
| `PARTS` | 两个示例零件号 | 要监控的型号（第二步） |
| `CENTERS` | `[{ location: "10001" }]` | 查询中心，每个中心覆盖最近的 12 家门店（第三步） |
| `CPPART` | `"UNLOCKED/US"` | 运营商版本，一般不用改 |
| `INTERVAL_MIN` | `10` | 平均每隔几分钟检查一次，建议不低于 5 |
| `JITTER` | `0.3` | 每次等待时间随机浮动最多 ±30% |
| `RELOAD_MIN` | `60` | 平均每隔几分钟刷新一次页面 |
| `RELOAD_MIN_FALLBACK` | `20` | 上一次检查用到旧接口时的页面刷新间隔 |

**`background.js`**

| 设置 | 默认值 | 作用 |
|---|---|---|
| `NTFY_TOPIC` | `""` | ntfy 频道名，留空表示不用 ntfy |
| `PUSHOVER_TOKEN`、`PUSHOVER_USER` | `""` | Pushover 密钥，都留空表示不用 Pushover |
| `PUSHOVER_SOUND` | `"persistent"` | Pushover 提示音，上传 `alarm30.mp3` 后改成 `"alarm30"` |
| `HEALTHCHECK_URL` | `""` | Healthchecks.io 的 Ping URL，留空表示不用 |
| `HEARTBEAT_HOURS` | `12` | 每隔几小时发一次 “still running” |
| `AUTO_REOPEN` | `true` | 购买页标签页被关掉或 Chrome 重启后自动重新打开 |

改完任何设置后，到 `chrome://extensions` 刷新扩展，再刷新购买页。

## 常见问题

**我的 iPhone 在静音状态下可以收到闹铃通知吗？**
可以，前提是按方案 B 设置了 Pushover 并打开了关键提醒。iPhone 处于系统默认的睡眠专注模式时，也可以收到闹铃通知。

**怎么确认自己有没有被 Apple 限制访问？**
用 Chrome 正常打开 iPhone 购买页，看 **Add to Bag** 按钮上方。如果同时显示 **Delivers to ...**（配送）和 **Pickup: ...**（取货）两行信息，就说明一切正常。如果这两行都没有，只剩一个 Add to Bag 按钮，说明你的电脑或网络被 Apple 暂时限制了，先停用扩展，过一段时间再试。

**标签页标题显示 `[Blocked ...]` 或 `[Waiting until ...]` 怎么办？**
扩展会自动等待后重试，每次等待时间逐渐变长（5、10、20 分钟，之后每 30 分钟一次），等待期间不发任何请求。连续 3 次失败会推送提醒。想立刻清除等待状态重新开始，可以关掉购买页标签页，新开一个标签页重新打开。如果一直这样，先停用扩展。然后按上一个问题的方法检查是否被 Apple 限制。如果被限制了，只能等一段时间再试。恢复后把 `INTERVAL_MIN` 调大一些。

**标题一直没变化？**
确认修改文件后点了扩展的刷新按钮，并刷新了购买页。在购买页按 F12 → 控制台，看有没有 `[Apple Watcher]` 开头的日志，如果显示「No part numbers set」，检查 `main.js` 里的 `PARTS`。如果显示「Another Apple buy page tab is doing the checks」，说明是另一个购买页标签页在负责检测，这是正常的。

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
