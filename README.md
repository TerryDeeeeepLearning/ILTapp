# IELTS Listening Trainer — Phase 1

離線可用的雅思聽力訓練器。**無帳號、無伺服器、無雲端**，所有資料只存在你的裝置上。

規格書見 `SPEC.md`（單一真實來源）。本目錄為 Phase 1 交付。

---

## 快速開始

```bash
npm install
npm run dev          # http://localhost:5173
```

沒有音檔也能立刻用 —— App 會自動降級為系統語音，播放器上會標示「即時語音・品質較低」。

---

## 生成正式音檔（強烈建議，會解鎖完整功能）

系統語音無法 seek、無法 AB 循環、語速調整受限。生成 MP3 後這些全部解鎖。

```bash
pip install edge-tts          # 免費，不需 API key
brew install ffmpeg           # 或 apt install ffmpeg
npm run audio
```

產出：

```
public/audio/core-starter/*.mp3
public/audio/core-starter/pack.json
```

**重新整理 App 即自動升級**，不需改任何程式碼。App 啟動時會抓 `pack.json`，找到就把 MP3 掛上去（含逐詞時間戳 → 卡拉 OK 高亮、波形、AB 循環、0.5–3.0× 連續調速），找不到就靜靜降級。

重跑已生成的檔案：`npm run audio -- --force`

---

## 安裝到 iPhone（離線使用）

1. 電腦與 iPhone 連同一個 Wi-Fi
2. `npm run build && npm run preview -- --host`
3. iPhone Safari 開終端機顯示的區域網路網址
4. 分享 → **加入主畫面**
5. 從主畫面圖示啟動，開飛航模式驗證離線可用

> 加入主畫面的 PWA 可豁免 Safari 的 7 天未使用清除規則，且 App 啟動時會呼叫 `navigator.storage.persist()` 進一步降低資料被清除的風險。設定頁可查看已用空間與持久化狀態。

要長期使用，部署到 GitHub Pages（見下節）。

---

## 部署到 GitHub Pages

已附 `.github/workflows/deploy.yml`，推上去就自動部署，不需要伺服器也不用付費。

**一次性設定：**

1. 在 GitHub 建一個 repo（**public**，免費帳號的 Pages 只支援公開 repo）
2. 把專案推上去：
   ```bash
   git init
   git add -A
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<repo 名>.git
   git push -u origin main
   ```
3. GitHub repo 頁面 → **Settings → Pages → Source** 選 **GitHub Actions**

推完約兩分鐘後，網址是 `https://<你的帳號>.github.io/<repo 名>/`。之後每次 `git push` 都會自動重新部署。

**流程會先跑 `npm run validate`、`tsc -b`、`vitest run`，任何一項失敗就不部署** —— 壞掉的判分邏輯不會上線。

### 音檔怎麼處理

兩種做法，擇一：

| 做法 | 說明 |
|---|---|
| **提交進 repo（建議）** | 本機跑 `npm run audio`，把 `public/audio/` 一起 commit。部署最快最穩，缺點是 repo 會變大（種子題庫約 3–5 MB，可接受） |
| **交給 CI 生成** | 不提交音檔，workflow 偵測到 `pack.json` 不存在時會自動 `pip install edge-tts` 現場生成。失敗也不擋部署，App 會降級為系統語音 |

音檔若超過 100 MB，改用 Git LFS 或另外放 CDN。種子階段用不到。

### 為什麼能在子路徑正常運作

- `vite.config.ts` 的 `base: './'` → 所有資產走相對路徑
- 路由用 `HashRouter` → 不需要伺服器端 rewrite，重新整理不會 404
- 音檔包用 `fetch('./audio/...')` → 自動跟著子路徑走
- workflow 會 `touch dist/.nojekyll` → 避免 Jekyll 吃掉底線開頭的檔案

---

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | 正式建置（產出 `dist/`） |
| `npm run preview -- --host` | 預覽建置結果，供手機連線 |
| `npm test` | 執行測試（判分引擎 / SM-2 / 磁吸滑桿） |
| `npm run validate` | 題庫規則校驗 |
| `npm run check` | 完整驗收：校驗 + 型別 + 測試 + 建置 |
| `npm run audio` | 生成音檔與逐詞時間戳 |
| `npm run icons` | 重新生成 PWA 圖示 |

---

## 已實作（Phase 1）

- **句級聽寫** 三種模式：完全隱藏（整句聽寫）／顯示挖空（標準填空，一句多格同時作答）／完整顯示（聽讀）
- **題庫 20 題 40 個空格**，口音配比 GB40／AU20／US20／CA10／NZ10，數字類考點佔 23%
- **語速滑桿** 0.5–3.0×，9 段磁吸刻度，1.0× 加強回饋
- **提示分級** L1 縮小範圍 −25% ／ L2 首字母 −50% ／ L3 公布解答 −100%
- **公布解答的完整後果**：該題 0 分 + 強制排入隔日複習 + 事前確認框
- **判分規則**：拼錯即錯但顯示字母級 diff；大小寫不計較；複數 s 計較；連字號可設定；`15` ⇄ `fifteen`；`St` ⇄ `Street`；英式 `double four` ⇄ `44`
- **失分歸因**：六選一，系統依編輯距離／作答時間／誘答命中預選
- **逐字稿**：卡拉 OK 逐詞高亮、點詞跳播與加入生字本、錯誤 diff 視覺化
- **SM-2 間隔重複**：含 leech 標記、複習排序、L3 強制覆寫
- **設定**：深淺色、5 級字級、色盲友善配色、判分規則、回饋管道測試、匯出／匯入／重設

## 尚未實作（依 SPEC.md 排程）

Phase 2 內容管線分包下載　·　Phase 3 其餘 8 種練習模式與全真模考　·　Phase 4 弱點分析與遊戲化　·　Phase 5 Claude API 選配出題

---

## 平台限制（已正面處理，非疏漏）

| 限制 | 處理方式 |
|---|---|
| iOS Safari **不支援** `navigator.vibrate` | 三層降級：系統震動 → iOS 17.4+ switch 元件 haptic → 8ms click 音效 + 刻度視覺脈衝。設定頁可查看目前實際使用的管道並測試。 |
| iOS 需手勢才能播放音訊 | 進入練習前的「點一下開始」全螢幕閘門，同時解鎖 WebAudio 與語音合成 |
| iOS 鍵盤遮擋輸入框 | `VisualViewport` 監聽並自動捲動作答格到可視區中央 |
| 自動更正會直接送分 | 所有作答框強制關閉 `autocorrect` / `autocapitalize` / `spellcheck` |

---

## 版權

所有聽力文本為原創撰寫。**未使用、未改寫任何劍橋雅思或官方真題內容。**
新增題目時請維持這條線，並執行 `npm run validate`。
