# Apple Pickup Watcher

[中文说明](README.zh-CN.md)

A Chrome extension that watches in-store pickup availability at Apple Stores. When the iPhone you want comes into stock, your phone gets a push notification right away. With Pushover, it can even wake you up like an alarm.

## How it works

The extension runs in your own Chrome, on an Apple iPhone buy page. Every few minutes it checks pickup availability at nearby stores. The checks use your browser's real session, and Apple's own page scripts keep the cookies fresh, so you never have to copy cookies or keep refreshing by hand.

When stock is found:

- **ntfy**: your phone gets a normal push notification with the store and the model.
- **Pushover** (optional): your phone plays an emergency alert that ignores silent mode and Do Not Disturb. It repeats every 30 seconds until you acknowledge it.

## Before you start

- This is an unofficial tool. It relies on an undocumented endpoint on Apple's website and may break if Apple changes it.
- Checking too often gets you temporarily blocked by Apple (status code 541; even normal browsing stops showing pickup info). The default is once every 5 minutes. Please don't set it much lower.
- The buy page tab must stay open, and the computer must not sleep.
- Currently supports iPhone buy pages on the US Apple Store website only.

---

## Step 1: Install the extension

1. Download this project and unzip it. On GitHub, click **Code → Download ZIP**. The unzipped folder may be named `apple-pickup-watcher-main`; that is fine.
2. Go to `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked** and select the unzipped folder (the level where you can see `manifest.json`).

Whenever you edit a file, go back to `chrome://extensions`, click the reload button ↻ on the extension card, then refresh the Apple buy page. Otherwise your changes won't take effect.

## Step 2: Choose the models to watch

Open `main.js` and edit `PARTS` at the top. These are Apple's internal part numbers. Each color, capacity and version has its own.

**How to find a part number:**

1. In Chrome, open the iPhone buy page on Apple's website and pick the model, color and capacity.
2. Press **F12** (on Mac: Command + Option + I) and open the **Network** tab.
3. Type `fulfillment` in the filter box, then press **F5** to reload the page.
4. Click the `fulfillment-messages` request. In its URL, find the value after `parts.0=`, for example `MK1E4LL/A`. If it shows as `MK1E4LL%2FA`, the `%2F` is just `/`.
5. To watch several colors or capacities, switch the configuration and repeat.

Put them in `main.js`:

```js
const PARTS = ["MK1E4LL/A", "MK1F4LL/A"];
```

## Step 3: Choose the store area

Also in `main.js`, edit `CENTERS`:

```js
const CENTERS = [{ location: "10001" }, { location: "19103" }];
```

- For each center, Apple returns the **12 nearest** stores.
- One ZIP code for where you live is usually enough. To cover stores farther away, add a ZIP code from that area. Results are merged and duplicates removed.
- More centers means more requests per round and a higher chance of being blocked. Two or three at most is a good limit.

## Step 4: Set up phone notifications

You need a push notification app on your phone to receive alerts. Two kinds are useful:

- **A simple push app**: sends a normal notification when stock is found.
- **An alarm-level alert app**: rings even in silent mode or Do Not Disturb, so it can wake you up.

Any app of these kinds will do in principle. The extension currently has built-in support for **ntfy** and **Pushover**, so this guide uses them as examples. To use a different app, edit the `notify()` function in `background.js`.

### Option A: Simple push notifications (example: ntfy)

1. Install **ntfy** on your phone (App Store on iOS, Google Play on Android).
2. Open the app, tap **+**, and subscribe to a topic. Make up a long, hard-to-guess name, such as `iphone-alert-k7x29q`.
   ntfy topics are public. Anyone who knows the name can read the messages, so avoid simple names.
3. Open `background.js` and fill in the topic:
   ```js
   const NTFY_TOPIC = "iphone-alert-k7x29q";
   ```
4. **Test it**: run this in a terminal (or Command Prompt). If your phone shows "test", it works:
   ```
   curl -d "test" ntfy.sh/iphone-alert-k7x29q
   ```

### Option B: Alarm-level alerts (example: Pushover)

Use this if you don't want to miss stock while you sleep. Normal notifications stay quiet in silent mode or Sleep Focus. Pushover's emergency notifications can use iOS Critical Alerts, which ignore silent mode and Do Not Disturb.

Pushover has a free trial. After that it is a one-time in-app purchase; check your app store for the price.

1. **Install and sign up**: install **Pushover** on your phone, create an account and log in.
2. **Turn on Critical Alerts (iOS)**: Pushover app → Settings → turn on **Critical Alerts for high-priority**, and tap **Allow** on the system prompt.
   Then go to iPhone Settings → Notifications → Pushover and make sure **Allow Notifications**, **Sounds** and **Critical Alerts** are all on.
3. **Get your User Key**: log in at pushover.net on your computer. The string under **Your User Key** on the right is it.
4. **Get an API Token**: scroll to the bottom of pushover.net → **Create an Application/API Token** → enter any name (e.g. `apple-watcher`) → check the terms box → **Create Application**. The **API Token** at the top of the new page is it.
5. **Fill them into `background.js`**:
   ```js
   const PUSHOVER_TOKEN = "your API Token";
   const PUSHOVER_USER = "your User Key";
   ```
6. **Test from the website first**: on the pushover.net home page, use Push a Notification on the left, set Priority to **Emergency**, and send. Put your phone on silent; it should still ring, and stop once you open and acknowledge it.

**Optional: use a longer alarm sound**

Pushover emergency alerts repeat at most every 30 seconds, and the built-in sounds are short, so there is a long silence in between. This project includes an original 30-second marimba alarm, `alarm30.mp3`. Upload it to get close to continuous ringing:

1. On pushover.net, find **Your Custom Sounds**, upload `alarm30.mp3`, and name it `alarm30`.
2. Fully close the Pushover app on your phone and open it again so it syncs the new sound.
3. Edit `background.js`:
   ```js
   const PUSHOVER_SOUND = "alarm30";
   ```

You can use ntfy and Pushover together. Every message goes to ntfy; only the "in stock" message also triggers the Pushover alarm.

### Status notifications (on by default, needs ntfy only)

With ntfy set up, besides stock alerts you also get:

| Notification | When |
|---|---|
| Apple watcher started | The buy page is opened and the first check succeeds |
| Apple watcher still running | Every 12 hours, to confirm it is still working (change `HEARTBEAT_HOURS` in `background.js`) |
| Apple watcher stopped | The buy page tab is closed, or the browser is running but there has been no successful check for a while (about 20 minutes by default) |
| Apple watcher resumed | Checks work again after a stop |
| Apple watcher blocked | Blocked by Apple 3 times in a row |

**ntfy limits:** ntfy.sh applies rate limits to free users; see its website for the exact numbers. This extension normally sends only a few messages a day and won't come close.

### Optional: get alerted when the browser closes, the computer sleeps, or the internet drops (Healthchecks.io)

When the whole browser is closed, the computer sleeps, or the network is down, the extension stops too and cannot send anything. An outside service covers this: after every successful check, the extension pings Healthchecks.io. If the pings stop for too long, Healthchecks.io notifies you through ntfy. Healthchecks.io is one of ntfy's official integrations and is free for personal use.

1. Go to healthchecks.io, sign up and log in.
2. Click **Add Check** and give it any name, such as `apple-watcher`.
3. Change the schedule (Period / Grace):
   - **Period**: `5 minutes` (same as `INTERVAL_MIN` in `main.js`)
   - **Grace**: `15 minutes`
4. Copy the check's **Ping URL**, which looks like `https://hc-ping.com/xxxxxxxx-xxxx-...`.
5. Open **Integrations** in your project, find **ntfy**, and click **Add Integration**:
   - Topic: your ntfy topic name
   - Server: keep `https://ntfy.sh`
   - Save
6. Go back to the check and make sure ntfy is turned on under Notifications.
7. Put the URL in `background.js`:
   ```js
   const HEALTHCHECK_URL = "https://hc-ping.com/your-uuid";
   ```

From then on, if the computer goes offline or sleeps for about 20 minutes, Healthchecks.io sends you a "down" notification, and an "up" notification when it recovers. Healthchecks.io also supports Pushover, so you can add it under Integrations if you want offline alerts to ring too.

## Step 5: Start and test

1. After editing files, click reload ↻ in `chrome://extensions`.
2. Open the Apple iPhone buy page from Step 2.
3. Wait about 20 seconds:
   - The tab title gets a prefix like `[No stock 01:04:36]`. This means the check worked.
   - Your phone gets "Watcher started. Checking N stores."
4. **Test the in-stock alert**: on the **Apple buy page**, press F12 → Console, paste this line and press Enter:
   ```js
   window.postMessage({__asw:true,title:"iPhone in stock",msg:"test"},"*")
   ```
   If Chrome blocks pasting, type `allow pasting` and press Enter first, then paste.
   ntfy should show "test" and Pushover should start ringing.
   This must be run in the console of the Apple buy page. Running it on any other page does nothing.

## Step 6: Keep it running (required)

If the computer sleeps or Chrome puts the tab to sleep, checking stops. Set these two things before you leave it running.

**1. Stop the computer from sleeping**

- **Mac**: System Settings → Battery → Options → turn on **"Prevent automatic sleeping on power adapter when the display is off"**. Keep the Mac plugged in, and keep a MacBook's lid open.
- **Windows**: Settings → System → Power (or Power & battery) → Screen and sleep → set the sleep option for when plugged in to **Never**.

The screen turning off is fine.

**2. Stop Chrome from putting the tab to sleep**

Chrome Settings → Performance → under **"Always keep these sites active"**, click **Add** and enter `apple.com`. Turning off Memory Saver also works.

## Daily use

- Keep the buy page tab open. Don't close it or navigate away. A separate, minimized Chrome window works well.
- The page reloads itself every 15 minutes. That is normal.
- When you get an in-stock alert, order quickly. Popular configurations often sell out within minutes.

## FAQ

**Will my iPhone ring when it is on silent?**
Yes, if you set up Pushover (Option B) and turned on Critical Alerts. The alarm also rings when the iPhone is in the default Sleep Focus.

**How do I check whether Apple is limiting me?**
Open the iPhone buy page normally in Chrome and look at the area above the **Add to Bag** button. If you see both a **Delivers to ...** line and a **Pickup: ...** line, you are fine. If both lines are missing and only the Add to Bag button is shown, Apple is temporarily limiting your computer or network. Disable the extension and try again later.

**The tab title shows `[Blocked ...]`. What now?**
The extension reloads the page and retries after 1 minute by itself, and sends an alert after 3 failures in a row. If it keeps happening, disable the extension first. Then check whether Apple is limiting you, as described in the question above. If you are limited, you can only wait and try again later. When it recovers, increase `INTERVAL_MIN`.

**The tab title never changes?**
Make sure you clicked reload on the extension after editing and refreshed the buy page. On the buy page, press F12 → Console and look for lines starting with `[Apple Watcher]`. If it says "No part numbers set", check `PARTS` in `main.js`.

**ntfy works but Pushover does nothing?**
In `chrome://extensions`, click the **Service Worker** link on the extension card to open the background console, then run the test again and look at the line starting with `pushover`. `"status":1` means it was sent. If it says the token or user is invalid, check for copy mistakes.

**Pushover notifies but makes no sound?**
Check item 2 of Option B in Step 4 and make sure Critical Alerts are allowed.

**What should I do before sharing this with friends?**
Remove your own ntfy topic and Pushover keys from `background.js`. Anyone with your keys can send notifications to your phone.

## Contact

Questions or problems? Email me at jefftsuei217@gmail.com. I don't check this inbox very often, but I will reply to every message I see.

## Disclaimer

This project is for personal learning only and is not affiliated with Apple. Please follow the Apple website's terms of use and keep the checking frequency reasonable.

If this project violates Apple's terms or infringes on any rights, please contact me at jefftsuei217@gmail.com and I will remove it.
