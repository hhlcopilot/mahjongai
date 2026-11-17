# 麻雀聽牌效率計算機

香港麻將（13 張）嘅打牌效率分析器。輸入手牌，即刻睇到**逐隻試打**之後嘅向聽數、聽／進張、剩餘張數，話你知邊隻打法效率最高。

純靜態網頁，唔需要後端、唔需要 build，直接用瀏覽器開 `index.html` 就用得。

## 功能

- 🀄 **手牌輸入**：撳牌加入手牌（13 或 14 張），撳手牌上面嘅牌可以拎走。
- 🎯 **逐隻試打**：14 張時自動試晒每一隻可以打嘅牌，列出向聽、聽咩牌、每隻牌仲有幾多張。
- 📊 **效率排序**：先比向聽數（越低越好）；同向聽下用 `有效牌張數 × √入聽質素` 排名——張數係主角，質素用平方根壓一壓。咁就唔會「53 張但全部聽單吊」贏咗「52 張但隻隻聽兩面」，亦唔會為咗聽闊少少而叫少 6 張牌。分數相差 **5% 以內**當一樣好。
- 🤖 **與 AI 實戰**：第 3 個 tab，你 + 3 個 AI 一檯（13 張、冇上牌、紅中百搭）。AI 打牌、碰、槓、食糊全部用同一個效率引擎；你可以碰、明槓、暗槓、補槓（碰完手上仲有第四隻 → 升級做槓並補一隻，可以槓上開花）。預設**只許自摸**（出銃唔算食糊，可以喺設定熄返）。實戰預設**走番子**（只出萬筒索 + 紅中，同用戶平時打嘅一樣；實測平均每人約 6 隻就有人食糊，熄咗走番子會變約 8-9 隻）。AI 打牌會喺「分數差 5% 內當一樣好」嗰堆隨機揀，唔會隻隻都同一個最優解。摸到嘅牌會擺喺手牌最右邊並加金色框。每局完結會有**本局摘要**：第幾巡完結、牌牆剩幾張、四家各自打出／碰／槓次數、你嘅最終手牌（食糊／聽牌／幾向聽）、**最優打牌率**（你打嘅牌同引擎最佳打牌差 5% 內就當夾），同埋累計戰績（存 localStorage）。
摘要下面仲有**打牌檢討**：逐手列出偏離引擎最佳嘅打牌，包括第幾巡、你打咗邊隻、應該打邊隻、向聽數／有效牌張數／入聽後平均聽幾多張嘅差距，同埋當時手牌（牌面圖）。唔計番數（純練打法）。
- 🀫 **計埋碰牌**：手牌有一對就可以碰，三家都有機會打出，所以對子會額外加權（`×1.6`；手上有紅中則 `×2.2`，因為碰完可以單吊中＝任何牌都食糊）；結果會列出「可碰」邊幾隻。已聽牌時唔會提示碰（碰會拆聽）。
- 🀫 **暗槓（有錢收，但唔會亂槓）**：手上有四張相同會計「暗槓之後」嘅向聽；**槓完唔蝕向聽先建議槓**（槓有錢收，同向聽優先槓），槓完會補一隻。如果槓完向聽變差（例如 `45555索`，槓咗就冇咗 45 呢個搭子），就唔會建議槓，只會解釋原因。任何情況下都唔會建議你打走第四張（拆槓排最後並標示）。
- 🀫 **紅中百搭**：預設將「中」當百搭牌（可自由變身），所以摸到中都計和了；亦可以關閉，當普通牌計。
- 🀫 **副露（碰／槓）**：自己有碰／槓都可以入，每副會令手牌上限少 3 張（14 → 11 → 8 → 5 → 2）。香港麻將冇上牌，所以唔提供「上」。手牌本身有嗰幾張會自動撥入副露，唔使自己拎走（例如手上有東東，撳「碰 → 東」就會自動扣走兩張東）。
- 👀 **已見牌**：可以輸入牌河／副露／碰過嘅牌，剩餘張數會扣減，估得準啲。
- 🂠 **七對子（可選）**：部分牌局有計七對，預設關閉。
- 📈 **下巡命中率**：有效牌 ÷ 未見牌，粗略估算下一巡食糊機會。
- 🎲 **隨機練習**（`practice.html`）：隨機出牌型，你揀會打邊隻，即刻對答案＋睇全部打法比較；有難度（初級／中級／高級）、可開副露，成績會記低。
  - 每題都有**隨機牌河**同**其他玩家嘅碰**，剩餘張數唔同，最佳打法都會唔同。
  - **兩向聽要揀兩次**：第一次揀完會隨機摸一隻牌（藍框標示），再揀一次，兩步都會計分。
  - **走番子**（預設開）：只會出萬／筒／索＋紅中，唔會有東南西北發白，避免「兩隻孤張番子」呢類冇意義嘅題目。
- 📲 **PWA**：可以「加入主畫面／安裝應用程式」，全螢幕開啟，第一次載入之後**冇網絡都用得**。
- 📱 **手機優化**：牌面大小自動跟螢幕闊度縮放、底部有浮動「建議打邊隻」快捷條（撳一下跳去詳細結果）、加牌有震動回饋、撳到滿咗會震一下＋搖一搖提示。
- 🀄 **真實牌面圖**：34 張牌面由真實牌面圖裁出（`tiles/tile-00.png` … `tile-33.png`，2 倍解像度、透明圓角），萬／筒／索／字都係實牌樣式；`aria-label` 仍然係文字牌名，讀屏照讀。

## 效率點計

1. **向聽數**越少越好（-1 = 已和）。
2. 同向聽下，計「**入聽質素**」：逐隻有效牌假設摸到，再揀最好嘅打法，睇最後聽幾多張，乘埋剩餘張數。
3. 手牌有一對嘅牌（可以碰）會加權 `×1.6`，因為三家都可能打出。
   手上有紅中（百搭）時加權再高，變成 `×2.2`——因為碰完之後好大機會剩低一隻中做單吊，
   而「單吊百搭」＝ 34 種牌任何一隻都食糊，所以有中在手時，對子（碰）更值錢。
4. 為咗保持手機流暢，只有「進張數 ≥ 最佳 × 45%」嘅 1 向聽打法會做第 2 步精算。

## 用法

1. 有碰／槓就先開「副露」面板入返（揀 碰／槓 再撳牌），手牌上限會自動變成 11／8／5／2 張。
2. 撳下面嘅牌盤加入手牌。入到上限（啱啱摸牌）最好，系統會自動試晒所有打法。
3. 想更準就展開「已見牌」，將牌河／副露見到嘅牌撳入去（每撳一下 1→4→0 循環）。
4. 睇「分析結果」第一格＝建議打法；下面有全部打法嘅比較。手機可以撳底部快捷條直接跳去結果。

## 練習模式

開 `practice.html`（或喺頁首撳「練習」）：

1. 揀難度：**初級**（聽牌～一向聽）、**中級**（一～兩向聽）、**高級**（兩～三向聽）
2. 可以開「包含副露」，隨機會出有碰／槓嘅牌型
3. 撳你會打嘅嗰隻牌 → 即刻知答啱定答錯、最佳打法、同埋全部打法嘅比較
4. 「睇答案」唔計分；「下一手」繼續
5. 答對率同連續答對會記喺 `localStorage`

## 安裝（PWA）

- **Android Chrome**：右上選單 → 「安裝應用程式」／「加到主畫面」
- **iPhone Safari**：分享 → 「加入主畫面」
- **桌面 Chrome / Edge**：網址欄右邊嘅安裝圖示

裝好之後用 standalone 模式全螢幕開，`sw.js` 會快取 app shell，離線都計到牌。

## 單頁架構

計算器同練習**同一版頁**，用頂部兩個 tab 切換（`#calc` / `#practice`），唔會跳頁：

- `index.html` 有兩個 `<section class="view">`（`#viewCalc` / `#viewPractice`），用 `hidden` 切換
- 練習嘅元素 ID 全部加 `p` 前綴（`pOptJoker`、`pQuestion`…），避免同計算器撞 ID
- `<h1>` 同副標題會跟住 tab 換字，`document.title` 同步更新
- 實戰手牌列：**副露（碰／槓）同手牌排喺同一行最左邊**（副露細 82%、有分隔線），似真實牌桌；
  摸到嗰隻擺最右邊加金色框
- 練習好食 CPU，所以 `practice.js` 唔會喺載入時出題，第一次切去練習 tab 才 `MJPracticeView.start()`
- 實戰（第 3 個 tab）分兩層：`battle.js` 係**純遊戲核心**（發牌／摸打／碰槓／食糊／AI 決策，唔掂 DOM，可以 Node 測試）；
  `battle-ui.js` 只負責畫面同回合流程（`MJBattleView.start()` 只做初始化，對局由「新一局」開始）
- 開發用：網址加 `?dev=1` 會開 `MJBattleView.dev`（`get()` 讀牌局、`set(state)` 塞牌局），方便測試 UI 流程；正常使用唔會啟用
- 計算器嘅「建議打」dock 喺練習 tab 會自動收起（`body[data-view="practice"] #dock`）
- **網址永遠唔會變**：撳 tab 唔會改 hash／query；`強制更新` 同版本自我修復用 `location.reload()`
  （唔會加 `?_=123`）；當前 tab 記喺 `localStorage`（`mj-view`），重開都停喺同一個 tab
- 舊網址 `practice.html` 由 service worker 直接回 `index.html` 嘅內容，**網址保持 `practice.html` 唔跳轉**
  （冇 SW 時（例如第一次用）先會 fallback 去轉址頁 → `index.html#practice`）

## 已上線位置

| 位置 | 網址 | 用途 |
| --- | --- | --- |
| **Cloudflare Pages** | https://mahjongai-6nn.pages.dev/ | 主要公開網址（免費、無限流量、HTTPS） |
| GitHub | https://github.com/hhlcopilot/mahjongai | 原始碼（public） |
| NAS | https://sltpm.com/mahjongai/ | 自己後備（NAS 熄機／SSH 唔通時會自動跳過，唔會阻住 Cloudflare 部署） |

`./tools/publish.sh "改動說明"` 會一次過做齊：測試 → 部署 NAS → 部署 Cloudflare → push GitHub。

> Cloudflare Pages 預設開「Pretty URLs」：`/index.html` 會 308 轉去 `/`、`/practice.html` 轉去 `/practice`。
> 因為 service worker **唔可以用「被重定向」嘅 response 回應導覽請求**（會 `ERR_FAILED`），
> 所以 `sw.js` 內部一律用 `./`，並同時認得 `/practice` 同 `/practice.html`。

## 免費發佈到網上（Cloudflare Pages）

呢個站係**純靜態**（約 1.7MB、55 個檔案），任何免費靜態托管都跑得。建議 **Cloudflare Pages**
（無限流量、全球 CDN、免費 HTTPS、免費自訂域名）。

```
./tools/build.sh      # 產生 dist/（只含網站檔案，已加 _headers 同 .nojekyll）
```

`dist/` 會排除 `tests/`、`tools/`、`README.md`、`.htaccess`，並寫入 Cloudflare 用嘅
`_headers`（`index.html` / `sw.js` / `version.json` 設 `no-cache`，`css` / `js` / `tiles` / `icons`
設長期 cache——因為佢哋帶 `?v=N`，改版時 query 一變就自動攞新檔）。

### 一次性設定

1. GitHub 開一個新 repo（唔好加 README／.gitignore）
2. `git remote add origin git@github.com:<你嘅帳號>/mahjongai.git && git push -u origin main`
3. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 揀個 repo
4. 設定：
   - Framework preset：**None**
   - Build command：`bash tools/build.sh`
   - Build output directory：`dist`
5. **Save and Deploy** → 得到 `https://<專案名>.pages.dev`

之後每次 `git push` 就會自動重新部署。

### 想唔用 git 都可以

`./tools/build.sh` 之後，直接將 `dist/` 拖入 Cloudflare Pages 嘅 **Upload assets** 頁面
（或 `npx wrangler pages deploy dist`）即刻上線。

### 自訂域名

Cloudflare Pages 專案 → **Custom domains** → 加 `mahjong.sltpm.com`（如果 sltpm.com 嘅 DNS 已放喺
Cloudflare，一個掣就搞定；否則加一條 CNAME 指向 `<專案名>.pages.dev`）。HTTPS 自動簽發。

> ⚠️ PWA / Service Worker 一定要 HTTPS，Cloudflare Pages 預設已經有，唔需要額外設定。

## 部署（每次改完就做）

> ⚠️ VS Code 嘅 SFTP `uploadOnSave` **只會喺「編輯器儲存」時觸發**。我用指令碼改檔案（python / sed / 測試工具）唔會觸發，
> 所以要靠下面嘅 `tools/deploy.sh` 真正上載。兩者可以並存，但以 `deploy.sh` 為準（佢仲會備份 + 線上驗證）。

用戶要求：**每次改完就自動部署到 NAS，唔需要問**。



用戶要求：**每次改完就自動部署到 NAS，唔需要問**。

```
python3 tools/bump.py 52 53   # 有改到 css/js/html 就要升版本
./tools/deploy.sh --test      # 跑測試 → 檢查 → 打包 → 上載 → 備份 → 線上驗證
```

`tools/deploy.sh` 會做：

1. 跑 3 個測試檔（`--test`）
2. 檢查所有檔案唔係空檔（0 bytes）、`sw.js` 同 `js/*.js` 語法、`version.json` 同 `index.html` 版本一致
3. 打包（排除 `tests`、`tools`）→ `scp` 到 `kwy@sltpm.com:29`
4. 解壓到 `/volume1/web/mahjongai`、`chmod -R a+rX`、喺 `~/bak/` 存時間戳備份
5. 逐個檔案 `curl` 驗證 200 + 非空，再核對線上 `version.json` 同本地一致

## 更新版本注意

改咗 `css/` 或 `js/` 之後，**所有版本號一次過改**（唔改就會有手機停喺舊版）。
建議直接用：

```
python3 tools/bump.py 51 52   # 舊版本 新版本
```

手改就要改齊呢啲位：

1. `index.html`：`?v=N` → `?v=N+1`、`var V = 'N'`、頁尾 `id="buildTag"`
2. `sw.js`：`VERSION`、`ASSETS` 全部 `?v=N+1`
3. `js/ui-tiles.js`：`IMG_VERSION`
4. `js/app.js` / `js/practice.js`：`BUILD`
5. `version.json`：`{"v": "N+1"}`

### 防「停留喺舊版」機制

iOS 會用自己嘅 HTTP 快取 + service worker 快取，加上 NAS 冇 Cache-Control header，所以
成日出現「伺服器已更新，但手機仲顯示舊版」。三層保險：

| 層 | 做法 |
| --- | --- |
| HTML | `index.html` 嘅 `<head>` 有 inline bootstrap（唔靠 `app.js`，所以舊 JS 都照跑） |
| Service Worker | `register('sw.js?v=N', {updateViaCache:'none'})`——query 每次改，必中 cache miss；`install` 即 `skipWaiting()`、`activate` 即 `clients.claim()` |
| 版本檢查 | bootstrap 用 `cache:'no-store'` 攞 `version.json`，發現同頁面 `V` 唔同就清光所有 cache、unregister SW、再 reload 一次（`sessionStorage` 記錄防無限重載，`hardReset()` 有 2 秒 timeout 保險） |

`sw.js` 亦會**完全繞過** `version.json` 嘅快取（一定要直上網），導航請求用 network-first
並以原本 URL 做 cache key（唔可以寫死 `./index.html`，否則練習頁會覆蓋首頁）。

頁尾有「強制更新」連結，用戶自己撳一下就即刻清 cache 重載。

## 演算法

- **向聽數**：標準形（4 副 + 1 眼）。用遞迴拆牌搜尋所有「副／搭子／眼」組合，取
  `8 − 2×(副+副露) − min(搭子, 4−副−副露) − 眼` 嘅最小值；`-1` 代表已經食得。
- **副露**：每副副露當完成 1 副，所以手牌只計淨低嘅副數；副露嘅牌同時會扣減剩餘張數。
- **百搭**：拆牌時百搭可以補任何缺牌（刻子、順子、眼、搭子），搜尋會試齊所有補法。
- **有效牌**：向聽 0 時，逐隻 34 種牌試摸，摸完可以食糊就係「聽牌」；向聽 > 0 時，摸完向聽下降就係「進張」。
- **食糊判定**：一定要「完整一手」（手牌張數 = 14 − 3×副露）先算食糊；而且**碰／明槓之後唔可以即刻食糊**
  （冇摸牌就要打一隻）。向聽公式本身會忽略多出嚟嘅牌，所以要另外靠張數 + `fromClaim` 兩重檢查。
- **剩餘張數**：`4 − 自己手牌 − 已見牌`（打出去嗰隻都當已見）。

## 檔案結構

```
mahjongai/
├── index.html             # 單頁 App（計算器 ＋ 練習兩個 tab）
├── practice.html          # 舊網址，即刻轉去 index.html#practice
├── manifest.webmanifest   # PWA 設定
├── sw.js                  # Service Worker（離線快取）
├── favicon.svg
├── icons/                 # PWA 圖示（192/512/maskable/apple-touch）
├── tiles/                 # 34 張牌面圖（tile-00.png … tile-33.png）
├── css/style.css
├── js/
│   ├── mahjong.js   # 計算核心（向聽／聽牌／剩餘張數），可以獨立用 Node 執行
│   ├── ui-tiles.js  # 共用牌面元件
│   ├── app.js       # 計算器介面
│   ├── practice.js  # 練習模式（隨機出牌＋對答案）
│   ├── battle.js    # 實戰核心（4 人牌局、碰槓、食糊、只許自摸、AI 決策，純邏輯）
│   └── battle-ui.js # 實戰介面（回合流程、畫面）
└── tests/
    ├── mahjong.test.js  # 核心測試（含隨機手牌對比暴力法）
    ├── battle.test.js   # 實戰核心測試（發牌／碰槓／食糊／AI）
    └── sw.test.js       # Service Worker 邏輯測試
```

## 測試

```bash
node tests/mahjong.test.js
node tests/sw.test.js
```

> Service Worker 只會喺 `localhost` 或 HTTPS 下運作；用 `file://` 直接開 `index.html` 時，功能照用但唔會有離線快取。

## 限制

- 只計**標準形**（4 副 1 眼）＋可選七對子；唔計十三么、全不靠等特殊牌型。
- 七對子：單張之間唔會互相成對，只可以同百搭配對；4 張同款牌當 2 對（部分牌局要求 7 對唔同款，請自行判斷）。
- 唔計番數／台數（例如三番起糊嘅門檻），純粹睇牌效率。
- 未見牌只扣減自己手牌同已見牌，唔知對手手牌同牌山剩餘分佈。
- 跑馬仔／註碼玩法唔影響牌效率，所以冇計入。
