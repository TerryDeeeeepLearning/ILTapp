# IELTS Listening Trainer — 完整開發 Prompt（交付給 Claude Code）

> 使用方式：把本文件**整份**貼給 Claude Code，或放在專案根目錄命名為 `SPEC.md` 後對 Claude Code 說「請依 SPEC.md 執行 Phase 1」。
> 本文件即為需求的唯一真實來源（single source of truth）。任何實作上的取捨，優先遵守本文件；本文件未定義之處，選擇「離線可用、零成本、不需伺服器」的方案。

---

## 0. 給執行者（Claude Code）的指令

你是一位資深前端工程師 + 語言學習產品設計師。請依本規格書從零建立一個可運行的 IELTS 聽力訓練 PWA。

**硬性要求：**
1. 產出**可直接 `npm install && npm run dev` 運行**的完整專案，不是說明或片段。
2. **不得**使用任何需要付費或需要自架伺服器的服務。所有資料存在裝置本機。
3. 必須能安裝到 iPhone 主畫面並**完全離線**運行（含音檔播放）。
4. **不得**使用劍橋雅思官方音檔、真題文本或任何有版權的教材內容。所有腳本必須原創生成。
5. 每完成一個 Phase，執行一次自我驗收（見 §19），並回報未達成項目。
6. 遇到規格衝突或技術不可行，**先停下來說明並提出替代方案**，不要靜默改設計。

**回報格式：** 每個 Phase 結束時輸出：已完成檔案清單 / 驗收項目通過與否 / 已知限制 / 下一步。

---

## 1. 產品定義

| 項目 | 內容 |
|---|---|
| 產品名 | IELTS Listening Trainer（暫定，程式內以 `ILT` 為代號） |
| 目標用戶 | 亞洲考生，聽力 5.5 → 7.0，弱點集中在：英式/澳式口音、連音弱讀、數字與拼字聽寫、paraphrase 對應 |
| 核心價值 | 不是「做題目」，是**精準定位失分原因並針對性重練** |
| 使用者規模 | 單人自用（無帳號、無多用戶、無雲端同步） |
| 商業化 | **無**。不做付費牆、不做訂閱、不做廣告。所有功能全開。 |
| 介面語言 | 繁體中文為主，可切換英文（i18n 架構要留，但 MVP 只需完成繁中 + 英文兩份 locale） |
| 平台 | Web PWA（React），主要目標裝置 **iPhone Safari**，同時需在桌面 Chrome 正常運作 |

---

## 2. 技術架構決策

### 2.1 定案技術棧

```
React 18 + TypeScript 5 (strict)
Vite 5 (PWA plugin: vite-plugin-pwa, Workbox)
Tailwind CSS 3 + CSS Variables 主題系統
Zustand (狀態管理，含 persist middleware)
Dexie.js (IndexedDB ORM)
Framer Motion (動畫，僅用於必要處)
Recharts (弱點雷達圖)
Vitest + React Testing Library (單元測試)
Playwright (E2E，僅核心流程)
```

**後端：無。** 部署到 GitHub Pages（純靜態、免費、無需維護伺服器）。

### 2.2 被否決的方案與理由（不要再走回頭路）

| 方案 | 否決理由 |
|---|---|
| Supabase / Firebase | 違反「不架伺服器 + 免費 + 離線優先」。單人自用不需要帳號系統。 |
| 執行期 Web Speech API 作為**主要**音源 | iOS Safari 的 `speechSynthesis` 無法 seek、無法精準 AB 循環、無法取得波形、語速調整需重啟 utterance、PWA 背景易被中斷。品質與口音多樣性也不足以模擬雅思。**僅作為 Claude API 即時生成內容的降級音源。** |
| 原生 App（Swift / React Native） | 免費 Apple 開發者帳號的 sideload 憑證 7 天過期，自用場景維護成本過高。PWA 安裝到主畫面已滿足需求。 |
| 真人配音 | 成本與時程不成比例，且 Edge TTS 的 Neural 語音在雅思模擬場景已足夠。 |

### 2.3 音源架構（最重要的架構決策）

**雙軌制：**

- **主軌（Pre-baked，佔 95% 內容）**：開發階段以 Node/Python 腳本呼叫 **Edge TTS**（`edge-tts`，免費、無需 API key）離線生成 MP3，連同**逐詞時間戳 JSON** 一起 commit 進 repo。執行期用標準 `<audio>` 元素播放 → 完整支援 seek / AB 循環 / `playbackRate` 0.5–3.0 / 波形繪製 / 卡拉 OK 高亮。
- **副軌（Runtime，僅用於 Claude API 即時生成的新題）**：使用 `window.speechSynthesis` + iOS 內建語音（Daniel en-GB / Karen en-AU / Samantha en-US / Moira en-IE）。**UI 必須明確標示「即時語音（品質較低，不計入模考成績）」**，且此模式下停用 AB 循環與波形，語速僅提供 0.75 / 1.0 / 1.25 三檔。

### 2.4 iOS 平台限制（必須正面處理，不可假裝不存在）

| 限制 | 處理方式 |
|---|---|
| `navigator.vibrate` **在 iOS Safari 不支援** | 實作 `hapticTick()` 抽象層：① 嘗試 `navigator.vibrate`（Android 生效）② iOS 17.4+ 嘗試 `<input type="checkbox" switch>` 觸發原生 haptic 的 hack ③ 全部失敗則降級為「極短高頻 click 音效（WebAudio, 8ms, -30dB）+ 滑桿刻度視覺吸附動畫」。**絕不可因為 iOS 沒震動就靜默不做回饋。** |
| PWA 儲存配額與 7 天未使用清除 | 已安裝到主畫面的 PWA 豁免 7 天清除規則。仍須：啟動時呼叫 `navigator.storage.persist()`；設定頁顯示「已用空間 / 配額」；音檔採**分包（pack）按需下載**，非一次全載。 |
| 靜音鍵 / 背景播放 | `<audio>` 需設定 `playsInline`，並用 WebAudio 的 `AudioContext` 於首次使用者互動時 `resume()`。實作 `AudioUnlockGate`：首次進入練習前顯示「點擊開始」全螢幕遮罩以解鎖音訊。 |
| 鍵盤遮擋輸入框 | 使用 `VisualViewport API` 監聽並自動捲動作答格到可視區中央。 |
| 無實體鍵盤 | 所有鍵盤快捷鍵必須有等效觸控按鈕；手機版底部固定「重播 / 上一句 / 下一句 / 送出」工具列。 |

---

## 3. 專案結構

```
ilt/
├─ scripts/                      # 開發期工具（不進 bundle）
│  ├─ generate-audio.ts          # Edge TTS 批次生成
│  ├─ build-timings.ts           # WordBoundary → 逐詞時間戳
│  ├─ validate-content.ts        # 題庫規則校驗
│  └─ content/                   # 原創腳本原始檔 (YAML)
├─ public/
│  ├─ audio/{packId}/{itemId}.mp3
│  ├─ timings/{packId}/{itemId}.json
│  └─ manifest.webmanifest
├─ src/
│  ├─ app/                       # 路由、Layout、Providers
│  ├─ features/
│  │  ├─ player/                 # 音訊播放核心
│  │  ├─ dictation/              # 模式 ①
│  │  ├─ formfill/               # 模式 ②
│  │  ├─ paraphrase/             # 模式 ③
│  │  ├─ trap/                   # 模式 ④
│  │  ├─ map/                    # 模式 ⑤
│  │  ├─ matching/               # 模式 ⑥
│  │  ├─ lecture/                # 模式 ⑦
│  │  ├─ accent/                 # 模式 ⑧
│  │  ├─ mock/                   # 模式 ⑨ 全真模考
│  │  ├─ review/                 # SRS 複習
│  │  ├─ analytics/              # 弱點分析
│  │  └─ settings/
│  ├─ core/
│  │  ├─ grading/                # 判分引擎
│  │  ├─ srs/                    # SM-2
│  │  ├─ db/                     # Dexie schema
│  │  ├─ audio/                  # AudioEngine, TTS fallback
│  │  ├─ ai/                     # Claude API (optional)
│  │  └─ haptics/
│  ├─ components/ui/             # 設計系統原子元件
│  ├─ locales/{zh-TW,en}.json
│  └─ types/
└─ SPEC.md
```

---

## 4. 資料模型（TypeScript，必須逐字實作）

```ts
// ===== 內容層 =====

export type Accent = 'en-GB' | 'en-AU' | 'en-US' | 'en-CA' | 'en-NZ';
export type SectionNo = 1 | 2 | 3 | 4;
export type ExerciseMode =
  | 'dictation' | 'formfill' | 'paraphrase' | 'trap'
  | 'map' | 'matching' | 'lecture' | 'accent' | 'mock';

export interface Speaker {
  id: string;
  label: string;            // "Receptionist" / "Dr. Hayes"
  accent: Accent;
  voice: string;            // edge-tts voice id, e.g. "en-GB-RyanNeural"
  gender: 'M' | 'F';
  rateAdjust: number;       // -20 ~ +20 (%)，用於製造語速差異
}

export interface WordTiming {
  word: string;
  start: number;            // seconds
  end: number;
  charStart: number;        // 對應 transcript 字元索引
  charEnd: number;
}

export interface AudioAsset {
  id: string;
  packId: string;
  src: string;              // /audio/{packId}/{id}.mp3
  durationMs: number;
  bytes: number;
  timings: WordTiming[];    // 由 build-timings.ts 產生
  sentenceBoundaries: number[]; // 句首時間點（秒），供逐句導航
}

export interface Blank {
  id: string;
  /** 標準答案（第一個為主答案，其餘為可接受變體） */
  answers: string[];
  maxWords: number;         // 雅思常見 "NO MORE THAN TWO WORDS"
  numeric: boolean;         // 允許 15 / fifteen 互通
  hintFirstLetter: string;  // 由 answers[0] 自動推導
  hintLength: number[];     // 每個字的長度，e.g. [4,6]
  /** 在 transcript 中的位置，用於對答後高亮 */
  audioStart: number;
  audioEnd: number;
  /** 此空格考的是什麼能力，供弱點分析 */
  skillTags: SkillTag[];
}

export type SkillTag =
  | 'spelling-name'      // 姓名拼寫
  | 'number-phone'       // 電話號碼
  | 'number-date'        // 日期
  | 'number-money'       // 金額
  | 'number-general'
  | 'address'
  | 'paraphrase'         // 同義轉換
  | 'self-correction'    // 說話者自我更正
  | 'distractor'         // 干擾選項
  | 'connected-speech'   // 連音弱讀
  | 'academic-vocab'
  | 'signposting';       // 邏輯訊號詞

export interface ExerciseItem {
  id: string;
  packId: string;
  mode: ExerciseMode;
  section: SectionNo;
  title: string;
  topic: string;
  audio: AudioAsset;
  transcript: string;
  speakers: Speaker[];
  primaryAccent: Accent;
  difficulty: 1 | 2 | 3 | 4 | 5;
  blanks: Blank[];
  /** 選擇/配對題專用 */
  choices?: Choice[];
  /** 地圖題專用 */
  mapConfig?: MapConfig;
  /** 陷阱題：正確答案 vs 被更正掉的誘答 */
  traps?: { decoy: string; correct: string; atSecond: number }[];
  source: 'seed' | 'ai-generated';
  createdAt: number;
}

export interface Choice {
  id: string; label: string; correct: boolean;
  /** 為什麼錯（對答時顯示，這是提升學習效率的關鍵） */
  rationale: string;
  /** 錯誤選項在音檔中被提及的時間，可一鍵跳播 */
  mentionedAt?: number;
}

export interface MapConfig {
  imageSrc: string;         // SVG
  dropZones: { id: string; x: number; y: number; w: number; h: number; label: string }[];
  labels: { id: string; text: string; correctZoneId: string }[];
}

// ===== 學習紀錄層 =====

export type FailureReason =
  | 'not-heard'        // 我根本沒聽到
  | 'heard-misspelled' // 聽到了但拼錯
  | 'unknown-word'     // 不認識這個字
  | 'too-slow'         // 來不及打
  | 'misunderstood'    // 聽成別的意思
  | 'trap'             // 中了陷阱/誘答
  | 'correct';

export interface AttemptRecord {
  id: string;
  itemId: string;
  blankId: string;
  mode: ExerciseMode;
  userAnswer: string;
  isCorrect: boolean;
  score: number;              // 0 ~ 1，含提示扣分後
  replayCount: number;
  hintLevelUsed: 0 | 1 | 2 | 3;
  timeSpentMs: number;
  failureReason: FailureReason | null;  // 使用者自選
  autoReason: FailureReason | null;     // 系統推測（Levenshtein 判定）
  accent: Accent;
  skillTags: SkillTag[];
  playbackRate: number;
  timestamp: number;
}

export interface SrsCard {
  id: string;                 // = `${itemId}:${blankId}`
  itemId: string;
  blankId: string;
  easeFactor: number;         // SM-2, 初始 2.5
  intervalDays: number;
  repetitions: number;
  dueAt: number;              // epoch ms
  lapses: number;
  forcedTomorrow: boolean;    // 因看解答而強制排入
  status: 'new' | 'learning' | 'review' | 'mastered' | 'leech';
}

export interface MockExamResult {
  id: string;
  itemIds: string[];          // 4 個 Section
  answers: Record<string, string>;
  rawScore: number;           // 0-40
  bandScore: number;          // 換算帶分
  sectionScores: [number, number, number, number];
  durationMs: number;
  startedAt: number;
  perAccentAccuracy: Record<Accent, number>;
}

export interface VocabEntry {
  word: string;
  contextSentence: string;
  itemId: string;
  addedAt: number;
  note?: string;
}

export interface UserSettings {
  locale: 'zh-TW' | 'en';
  theme: 'light' | 'dark' | 'system';
  fontScale: 0.875 | 1 | 1.125 | 1.25 | 1.5;
  colorBlindSafe: boolean;
  defaultRate: number;
  hapticsEnabled: boolean;
  soundFeedbackEnabled: boolean;
  autoAdvance: boolean;
  strictHyphen: boolean;      // 預設 true
  claudeApiKey: string | null; // 僅存本機
  dailyGoalMinutes: number;
}
```

**Dexie schema：**
```ts
db.version(1).stores({
  items: 'id, packId, mode, section, primaryAccent, difficulty',
  attempts: 'id, itemId, blankId, timestamp, accent, mode, isCorrect',
  srs: 'id, dueAt, status, itemId',
  mocks: 'id, startedAt',
  vocab: 'word, addedAt',
  packs: 'id, downloadedAt',
  settings: 'key'
});
```

---

## 5. 音訊產製管線（`scripts/`）

### 5.1 腳本原始檔格式（YAML，人可編輯）

```yaml
id: s1-accommodation-01
mode: formfill
section: 1
topic: "Student accommodation enquiry"
primaryAccent: en-GB
difficulty: 2
speakers:
  - { id: A, label: "Housing Officer", accent: en-GB, voice: en-GB-SoniaNeural, gender: F, rateAdjust: 0 }
  - { id: B, label: "Student",         accent: en-AU, voice: en-AU-WilliamNeural, gender: M, rateAdjust: 5 }
lines:
  - { speaker: A, text: "Good morning, Riverside Student Housing. How can I help?" }
  - { speaker: B, text: "Hi, I'd like to enquire about a room for next term." }
  - { speaker: A, text: "Certainly. Could I take your surname?" }
  - { speaker: B, text: "It's Whitfield. W-H-I-T-F-I-E-L-D.", pauseAfter: 800 }
blanks:
  - { id: b1, answers: ["Whitfield"], maxWords: 1, skillTags: [spelling-name] }
```

### 5.2 `generate-audio.ts` 規格

1. 逐行呼叫 `edge-tts`，取得 audio chunk 與 `WordBoundary` 事件。
2. 依 `pauseAfter`（預設 350ms，換說話者 600ms，Section 間 3000ms）插入靜音。
3. 疊加極低音量（-48dB）室內底噪，避免 TTS 過度乾淨造成「假性易聽」。
4. 用 `ffmpeg` 合併輸出 **64kbps mono MP3**（相容 iOS，體積最小）。
5. 累加偏移量，把每行的 WordBoundary 轉成全域 `WordTiming[]`，輸出 `timings/{id}.json`。
6. 生成 `pack.json`（包含總大小、item 清單、checksum）。

**語音池（必須使用這些 edge-tts voice id）：**
```
en-GB: RyanNeural, SoniaNeural, LibbyNeural, ThomasNeural
en-AU: NatashaNeural, WilliamNeural, AnnetteNeural, DarrenNeural
en-US: GuyNeural, JennyNeural, AriaNeural, EricNeural
en-CA: ClaraNeural, LiamNeural
en-NZ: MitchellNeural, MollyNeural
```
口音配比：GB 40% / AU 20% / US 20% / CA 10% / NZ 10%。**Section 3 與 4 必須混用至少兩種口音。**

### 5.3 `validate-content.ts` 規則（CI 必跑）

- 每個 blank 的 `answers[0]` 必須在 transcript 中出現（大小寫不敏感）。
- 答案字數 ≤ `maxWords`。
- 同一 item 內答案不得重複。
- 每個 blank 必須至少有 1 個 `skillTag`。
- `audioStart/audioEnd` 必須落在音檔長度內，且由 timings 自動回填。
- 全題庫的 `skillTag` 覆蓋率：每個 tag 至少 15 題。
- 口音配比誤差 ≤ ±5%。

### 5.4 分包下載策略

- 每個 pack ≤ 25MB。啟動只載 `core-starter` pack（約 8MB）。
- 其餘 pack 在「題庫」頁顯示大小與下載按鈕，使用 Cache Storage 儲存，可單獨刪除。
- 下載中顯示進度條、可取消、斷線可續（分檔下載，非單一大檔）。

---

## 6. 資訊架構

```
/                     首頁 Dashboard
/practice             練習模式選擇（9 宮格）
/practice/:mode       模式設定頁（難度、口音、題數、語速）
/session/:sessionId   作答中（全螢幕、隱藏導航）
/session/:id/result   單次結果 + 逐字稿檢視
/review               今日複習（SRS 佇列）
/mock                 模考入口（警告頁）
/mock/live            模考進行中（不可離開）
/mock/:id/report      模考報告 + Band Score
/analytics            弱點分析
/vocab                生字本
/library              題庫管理 / 下載 / AI 生成
/settings             設定
```

### 6.1 首頁 Dashboard 元件（由上而下）

1. **今日進度環**：已練分鐘 / 目標分鐘，中心顯示連續天數火焰圖示。
2. **繼續上次**卡片：若有未完成 session，顯示模式名稱 + 進度 + 「繼續」。
3. **今日複習**：`N 張卡片到期`，紅點提示；0 張時顯示「已清空 ✓」並改推薦新練習。
4. **弱點速覽**：最弱的 2 個 skillTag + 最弱口音，各附「立即特訓」按鈕（直接帶參數進入對應模式）。
5. **快速開始**：4 個大按鈕 — 句級聽寫 / Section 1 快打 / 隨機挑戰 / 全真模考。
6. **本週趨勢**：7 日正確率折線 sparkline。

---

## 7. 全域元件規格

### 7.1 AudioPlayer（核心元件，所有模式共用）

**視覺區塊：**
- 波形圖（用 timings 計算的簡化 bar 圖，非真實波形，避免解碼成本）。已播放部分填色，未播放灰階。
- 句子分隔線：依 `sentenceBoundaries` 在波形上畫細豎線。
- AB 循環標記：A、B 兩個可拖曳把手，區間以半透明色塊覆蓋。
- 當前時間 / 總時長。
- **模考模式下：波形、進度條、AB 循環全部隱藏**，只顯示「播放中」與剩餘總時間。

**控制項：**

| 控制 | 桌面快捷鍵 | 手機 | 行為 |
|---|---|---|---|
| 播放/暫停 | `Space` | 底部工具列 | 若焦點在輸入框，`Space` 打空格；改用 `Ctrl/Cmd + Space` |
| 上一句 | `←` / `Ctrl+←` | 按鈕 | 跳到前一個 sentenceBoundary；若已播放 <1.5s 則跳前兩句 |
| 下一句 | `→` | 按鈕 | 下一個 boundary |
| 重播本句 | `R` / `Ctrl+R` | 按鈕 | 回到當前句首播放，`replayCount++` |
| 倒退 3 秒 | `Shift+←` | 長按上一句 | — |
| AB 循環 | `L` | 長按波形 | 第一次按設 A，第二次設 B 並開始循環，第三次清除 |
| 語速 | `[` `]` | 滑桿 | 見 7.2 |
| 下一格 | `Tab` | 鍵盤上方工具列 | 移動焦點 |
| 送出 | `Enter` | 按鈕 | 提交當前格 / 整題（依模式） |
| 提示 | `Ctrl+H` | 按鈕 | 開啟提示分級面板 |

**邊界狀況（必須處理）：**
- 音檔載入失敗 → 顯示「音檔無法載入」+ 重試按鈕 + 「改用即時語音」降級選項。
- 音檔尚未下載 → 顯示下載提示，不可進入作答。
- 播放到結尾 → 自動暫停並回到 0，**不自動重播**；顯示「已播完，可送出」。
- 使用者在播放中切換語速 → 保持當前播放位置不中斷。
- App 進入背景 → 暫停並記錄位置；回前景顯示「已暫停在 0:34，繼續？」。
- 模考模式播放中被打斷（來電）→ 恢復後**繼續播放，不倒回**（模擬真實考試），並在報告中記錄「曾中斷」。

### 7.2 語速滑桿（規格已由需求方指定，必須精確實作）

- 範圍 **0.50 – 3.00**，連續值，步進 0.01。
- **磁吸刻度**：`[0.50, 0.75, 0.90, 1.00, 1.25, 1.50, 2.00, 2.50, 3.00]`
- 磁吸行為：拖曳值進入刻度 ±0.03 範圍內時，**吸附**到該刻度並觸發 `hapticTick()`。使用者需明顯施力（拖出 ±0.06）才能脫離，模擬實體 detent。
- 觸發回饋（依 §2.4 降級鏈）：震動 → iOS haptic hack → 8ms click 音 + 刻度放大脈衝動畫。
- `1.00` 刻度使用**加強回饋**（雙擊震動 / 較大視覺脈衝），因為那是考試真實語速。
- 顯示：滑桿上方大字顯示 `1.25×`，非磁吸值顯示為 `1.13×`（兩位小數去尾）。
- **模考模式：滑桿完全禁用並鎖定 1.00×**，滑桿灰階並顯示鎖頭圖示，點擊時 toast「模考模式維持真實語速」。
- 練習模式若使用 <1.00× 完成題目，該次 attempt 記錄 `playbackRate`，且在弱點分析中**單獨統計**「慢速正確率 vs 原速正確率」的落差 —— 這是判斷「聽力真弱」還是「反應速度不足」的關鍵指標。

### 7.3 AnswerInput（作答格）

- 行內顯示為底線輸入框，寬度依 `hintLength` 動態計算（給予長度暗示是刻意設計，符合真題排版）。
- 即時字數計數：超過 `maxWords` 時邊框轉橘並顯示「最多 2 個字」。
- `autocapitalize="off" autocorrect="off" spellcheck="false"` —— **必須關閉，否則 iOS 自動更正會直接送分**。
- 支援貼上但清除格式。
- 未作答格在送出時以脈衝動畫提示，但**允許空白送出**（真實考試可以放棄）。
- 已作答格顯示淡色勾選點，不揭示對錯。

### 7.4 HintPanel（提示分級，需求方指定）

| 等級 | 內容 | 代價 |
|---|---|---|
| L0 重播 | 重播本句 | 前 2 次免費；第 3 次起每次 **−10%**，下限 50% |
| L1 縮小範圍 | 顯示答案的**詞性 + 字數結構**（例：名詞、2 個字，4 + 6 字母） | **−25%** |
| L2 首字母 | 顯示每個字首字母 + 底線（`W ____` / `Wh_____`） | **−50%** |
| L3 公布解答 | 顯示完整答案與該句原文 | **−100%（該題 0 分）** |

**L3 的額外後果（需求方明確指定）：**
1. 該題得分 = 0。
2. 對應 SrsCard 標記 `status: 'learning'`、`forcedTomorrow: true`，**強制排入隔日複習佇列**，忽略 SM-2 計算結果。
3. 弱點分析中該 blank 的 skillTags 記為「未掌握」。
4. UI 上必須**先顯示確認對話框**：「公布解答會使本題得 0 分，並排入明日複習。確定？」附「先試試首字母提示」次要按鈕。
5. 使用 L3 後，該題的輸入框**不鎖定**，仍鼓勵使用者親手打一次正確答案（打對後顯示「已記住，但本題仍計 0 分」），這對肌肉記憶與拼字有實質幫助。

### 7.5 失分歸因彈窗（需求方第 22 項，弱點分析準確度的核心）

答錯後**立即**顯示，不可跳過（但可設定關閉自動彈出，改為批次在結果頁補標）：

> 這題你是卡在哪裡？
> `[ 我沒聽到 ]` `[ 聽到了但拼錯 ]` `[ 不認識這個字 ]` `[ 來不及打 ]` `[ 聽成別的意思 ]` `[ 中了陷阱 ]`

- 系統同時計算 `autoReason`：
  - Levenshtein 距離 ≤ 2 且長度相近 → 推測 `heard-misspelled`
  - 空白 → 推測 `not-heard`
  - 答案是誘答（在 `traps.decoy` 中）→ 推測 `trap`
  - 作答耗時 > 該格平均 2 倍 → 推測 `too-slow`
- **預選**系統推測的選項，使用者一鍵確認即可（降低摩擦）。
- 兩者都存進 `AttemptRecord`，分析時以使用者自選為主、系統推測為輔（用於偵測自我認知偏差，例如使用者總說「沒聽到」但系統判定是拼字問題 → 在分析頁提示這個落差）。

### 7.6 TranscriptViewer（對答後）

- 卡拉 OK 式同步高亮：播放時依 `WordTiming` 逐詞高亮（當前詞用色塊，已播詞用較深文字色）。
- 作答空格處以底色標示：綠 = 正確、紅 = 錯誤、灰 = 使用提示。
- **點任一單字** → 底部彈出面板：發音（跳播該詞前後 1.5 秒）、詞性、中英釋義（本機字典 JSON，MVP 內建 3000 高頻詞；查無則顯示「加入生字本，稍後查詢」）、`+ 加入生字本`。
- **雙擊句子** → 標記「這句我聽不懂」，該句加入「難句本」，並自動生成一張 SRS 卡（模式為句級聽寫）。
- 逐句列表模式切換：長篇（Section 4）可切成一句一列，每列右側有單句重播鍵。
- 顯示每位說話者的口音標籤（🇬🇧 英式 / 🇦🇺 澳式），讓使用者建立口音—困難度的直覺關聯。

---

## 8. 九種練習模式（逐一規格）

> 共通流程：`模式設定頁 → 音訊解鎖 → 作答 → 送出 → 逐題回饋 → 失分歸因 → 結果頁 → 逐字稿檢視 → 加入 SRS`

### ① 句級聽寫 Dictation
- **設定項**：原文顯示模式（`隱藏全部` / `顯示但挖空` / `完整顯示`）、題數（10/20/30）、口音篩選、難度。
- `隱藏全部`：只有一個大輸入框，使用者打出整句。判分用逐詞比對，輸出詞級 diff（漏字 / 多字 / 拼錯分別標色）。
- `顯示但挖空`：顯示句子但關鍵詞為空格（即標準填空）。
- `完整顯示`：跟讀/理解模式，不作答，只練耳朵對應文字（供極弱者使用）。
- 每句 3–12 秒。自動 AB 循環在該句範圍內。
- **邊界**：整句聽寫的判分需容許標點與大小寫差異；連續 3 題全對自動提升難度一級（顯示 toast「難度已提升」，可在設定關閉）。

### ② Section 1 快打 FormFill
- 專攻雅思最高頻失分點。子題型（設定頁可多選）：
  - **姓名拼字**：音檔中以字母逐字拼出（`W-H-I-T-F-I-E-L-D`），使用者打出完整姓名。
  - **電話號碼**：含英式 `double four`、`oh` 代替 zero、`triple`。
  - **郵遞區號 / 門牌**：英澳格式混用。
  - **日期**：`the third of March` / `March the third` / `3rd March`。
  - **金額**：`fifteen pounds fifty` / `a hundred and twenty dollars`。
  - **時間**：`quarter past nine` / `half nine`（英式陷阱）。
- **極短單題**（3–8 秒），計時作答，有倒數環（預設 15 秒，可關）。
- **速度統計**：記錄每題作答秒數，結果頁顯示「平均反應時間」與趨勢，這是此模式的主 KPI。
- 判分規則對數字特別處理：`0447` = `oh four four seven` = `zero four four seven`。

### ③ 同義轉換辨識 Paraphrase
- 螢幕先顯示題目句（含 paraphrase 過的用詞），播放音檔後作答。
- 額外互動：對答時**並排顯示**「題目寫法」vs「音檔說法」，中間以箭頭連接，例：
  `reduce  ←→  cut down on`
- 每題自動把該組同義對應存入「Paraphrase 本」（獨立於生字本），可在 `/vocab` 切換分頁瀏覽與複習。
- 變體題型：**先聽後選**，四個選項中選出音檔的同義改寫（訓練被動辨識）。

### ④ 陷阱 / 自我更正 Trap
- 音檔刻意包含：自我更正（`sorry, actually...`）、否定重述（`it's not on Monday, it's on...`）、比較級誤導（`the cheaper option is...`）、被推翻的建議（`I thought about X, but in the end...`）。
- 作答後回饋**必須**顯示三段式：
  1. 你的答案（誘答）
  2. 音檔在 `0:14` 說了這個 → **可點擊跳播**
  3. 但在 `0:19` 被推翻 → **可點擊跳播**
- 統計「陷阱抵抗率」，作為獨立指標顯示在弱點分析。
- 設定頁可調「陷阱密度」（低/中/高），高密度用於考前衝刺。

### ⑤ 地圖 / 平面圖 Map
- SVG 底圖 + 拖曳標籤到 drop zone。桌面支援拖曳，手機支援「點標籤 → 點區域」兩段式（拖曳在手機上體驗差，必須提供點選模式）。
- 音檔含方位語言：`opposite`, `adjacent to`, `at the far end`, `clockwise from`, `on your left as you enter`。
- **輔助功能**：作答時可開啟「方位詞彙表」側欄（不扣分，這是理解工具不是答案提示）。
- 對答時：在地圖上動畫演示音檔描述的移動路徑（依 timings 同步），這是此模式的最大學習價值。
- 錯誤時標示「你放的位置」與「正確位置」，並跳播對應音檔片段。

### ⑥ 配對 / 多選 Matching
- Section 3 學術討論，2–4 位說話者。
- 題型：說話者觀點配對、多選（選 2 / 選 3）、分類配對。
- **說話者辨識輔助**：作答區上方顯示說話者頭像色塊，播放時當前說話者色塊亮起（依 timings 中的 speaker 標記）—— 練習模式可開，模考模式強制關閉。
- 對答時每個選項顯示 `rationale`（為什麼對 / 為什麼錯）+ 可跳播該選項在音檔中被提及之處。
- 多選題部分正確給部分分（選 2 對 1 = 0.5），但模考模式依真題規則計分。

### ⑦ Section 4 講座筆記 Lecture
- 5–7 分鐘單向學術獨白，**無停頓、無分段、不可 AB 循環（練習模式可開，模考強制關）**。
- 筆記填空版面：階層式縮排的筆記框架（模擬真題的 note completion）。
- 專屬功能 **「訊號詞雷達」**（練習模式限定）：對答後，把所有 signposting 詞（`firstly`, `however`, `crucially`, `to sum up`, `this brings me to`）在逐字稿中特別標色，並在側欄列成講座結構大綱 —— 教使用者「怎麼跟上講座結構」，而不只是對答案。
- 提供「只聽不寫」預覽模式：第一次先完整聽一遍不作答（訓練抓大意），第二次才作答。設定頁可開關。

### ⑧ 口音辨識特訓 Accent
- 同一段文本以 5 種口音各生成一次音檔（生成腳本需支援 `multiAccent: true` 旗標）。
- **模式 A 盲測**：播放後選「這是哪種口音？」→ 訓練口音敏感度。
- **模式 B 對比**：同句連播 5 種口音，使用者標記「哪個最難懂」，系統據此排定該使用者的口音訓練優先序。
- **模式 C 弱點口音特訓**：只播使用者最弱口音的題目，直到正確率達標。
- 針對口音特徵提供微教學卡（每張 30 秒可讀完）：
  - 澳式：`day` → /daɪ/、字尾 `-er` 弱化
  - 英式：非捲舌 r、`t` 喉塞音（`water` → `wa'er`）
  - 美式：flap t（`better` → `bedder`）、捲舌 r
  - 加式：`about` 的 Canadian raising
  - 紐式：`fish and chips` 的 /ɪ/ → /ə/
- 每張卡附 3 個最小對立音例句，可即時播放對比。

### ⑨ 全真模考 Mock
**進入前警告頁**（必須全部勾選才能開始）：
- ☐ 我有 32 分鐘不受打擾
- ☐ 我了解過程中不能暫停、不能重播、不能調語速
- ☐ 我已戴上耳機

**規則（嚴格模擬現行電腦考制）：**
- 4 個 Section 連續播放，共 40 題，30 分鐘。
- 音檔**不可暫停、不可倒回、不可調速**。
- 每個 Section 前有官方式指示語（需生成）與題目瀏覽時間（Section 內建於音檔）。
- 播放結束後給 **2 分鐘**檢查（電腦考制已無 10 分鐘謄寫時間）。
- 全螢幕，隱藏所有導航；嘗試離開觸發 `beforeunload` + 應用內確認框「離開將作廢本次模考」。
- 右上角常駐計時器，最後 5 分鐘轉紅並脈衝。
- 底部題號導航列（1–40），已答題號填色，可點擊跳題（真實電腦考有此功能）。
- 支援「標記待確認」旗標。

**模考報告頁：**
- Raw score 40 → Band Score（換算表見 §9.5）。
- 四個 Section 分項得分條。
- 口音別正確率。
- 題型別正確率。
- 與過去模考的趨勢折線。
- 「檢討本次錯題」按鈕 → 全部錯題自動加入 SRS 並開啟複習流程。
- 逐題檢視：題目 / 你的答案 / 正確答案 / 跳播音檔片段 / 逐字稿定位。

---

## 9. 判分引擎（`core/grading/`）

### 9.1 正規化流程

```
normalize(input):
  1. trim，全形轉半形
  2. 連續空白壓成單一空白
  3. 移除句末標點 . , ! ?
  4. 轉小寫                          // 大小寫不計較（需求 15）
  5. 保留連字號                      // strictHyphen=true 時 "car-park" ≠ "car park"
  6. 保留複數 s                      // 複數計較（需求 14/15）
  7. 縮寫等價展開（見 9.2）
  8. 數字詞互轉（見 9.3）
```

### 9.2 縮寫等價表（雙向可接受，需可擴充）

```
st ↔ street        rd ↔ road         ave ↔ avenue
dr ↔ drive         ln ↔ lane         sq ↔ square
mt ↔ mount         apt ↔ apartment   dept ↔ department
uni ↔ university   info ↔ information
mon ↔ monday ... sun ↔ sunday
jan ↔ january ... dec ↔ december
```

### 9.3 數字處理

- `15` ⇄ `fifteen` 皆接受（`numeric: true` 時）。
- 序數：`3rd` ⇄ `third` ⇄ `3`。
- 金額：`£15.50` ⇄ `15.50` ⇄ `fifteen pounds fifty`（貨幣符號可省略，但若題幹已印 `£` 則答案不得重複寫）。
- 電話：移除所有空白與連字號後比對純數字串。
- 日期：`3 March` ⇄ `March 3` ⇄ `3rd March` ⇄ `3/3`（僅當 `skillTag` 含 `number-date`）。

### 9.4 得分計算（虛擬碼）

```
function gradeBlank(blank, userAnswer, ctx): AttemptRecord {
  const norm = normalize(userAnswer)
  const accepted = blank.answers.map(normalize)

  // 字數超限直接錯（真實考試規則）
  if (wordCount(norm) > blank.maxWords) return fail('word-limit')

  let isCorrect = accepted.includes(norm)

  // 未命中 → 計算編輯距離供歸因，但不放寬判定
  let dist = min(accepted.map(a => levenshtein(norm, a)))
  let autoReason =
      norm === ''                        ? 'not-heard'
    : dist <= 2                          ? 'heard-misspelled'
    : isDecoy(norm, ctx.item.traps)      ? 'trap'
    : ctx.timeSpentMs > ctx.avgTime * 2  ? 'too-slow'
    :                                      'misunderstood'

  // 提示扣分
  let multiplier = 1.0
  if (ctx.replayCount > 2) multiplier -= 0.10 * (ctx.replayCount - 2)
  multiplier = max(multiplier, 0.5)
  if (ctx.hintLevelUsed >= 1) multiplier = min(multiplier, 0.75)
  if (ctx.hintLevelUsed >= 2) multiplier = min(multiplier, 0.50)
  if (ctx.hintLevelUsed >= 3) multiplier = 0                 // 需求 12

  const score = isCorrect ? multiplier : 0
  return { isCorrect, score, autoReason, dist, ... }
}
```

**重要：`isCorrect` 與 `score` 分離。** 拼錯就是錯（需求 14），但 UI 必須顯示**字母級 diff**：

```
你的答案：  W h i t f e i l d
正確答案：  W h i t f i e l d
                    ↑ ↑  這兩個字母顛倒
```
並自動把該詞加入「拼字弱點庫」，累積 3 次後生成專屬拼字卡（只練這個字的聽寫）。

### 9.5 Band Score 換算表（Academic Listening）

```
40-39 → 9.0   38-37 → 8.5   36-35 → 8.0   34-32 → 7.5
31-30 → 7.0   29-26 → 6.5   25-23 → 6.0   22-18 → 5.5
17-16 → 5.0   15-13 → 4.5   12-11 → 4.0   10-8  → 3.5
 7-6  → 3.0    5-4  → 2.5    <4   → 2.0
```
UI 標註「此為概估，實際帶分依考場版本浮動」。

---

## 10. 間隔重複（SM-2 變體）

```
質量分 q（0-5）由本次表現推導：
  正確 + 無提示 + 一次過        → 5
  正確 + 重播 ≤2               → 4
  正確 + 用了 L1/L2 提示        → 3
  錯誤 + 編輯距離 ≤2（拼字錯）  → 2
  錯誤                         → 1
  用了 L3 公布解答              → 0

if q < 3:
   repetitions = 0
   intervalDays = 1
   lapses++
   if lapses >= 5 → status = 'leech'（在複習頁單獨列出，建議換方式攻克）
else:
   EF = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
   EF = clamp(EF, 1.3, 2.8)
   repetitions++
   intervalDays = repetitions === 1 ? 1
                : repetitions === 2 ? 6
                : round(prevInterval * EF)

if forcedTomorrow (L3 使用) → intervalDays = 1，覆寫上述結果
if intervalDays >= 60 && q >= 4 → status = 'mastered'
dueAt = now + intervalDays * 86400000
```

**複習頁 `/review`：**
- 卡片以原練習模式呈現（聽寫卡就用聽寫介面），不做成單純的翻卡。
- 每日上限（預設 40 張，可調），避免堆積造成放棄。
- 到期卡排序：leech 優先 → 逾期最久 → 難度高。
- 提供「今日只練 10 分鐘」按鈕，自動抓取可在 10 分鐘內完成的卡量。

---

## 11. 弱點分析 `/analytics`

### 11.1 四軸雷達圖（Recharts）

1. **口音軸**：GB / AU / US / CA / NZ 正確率
2. **題型軸**：9 種模式正確率
3. **失分原因軸**：沒聽到 / 拼錯 / 生字 / 太慢 / 誤解 / 中陷阱 的分布（此軸用堆疊長條，非雷達）
4. **Section 軸**：S1–S4 正確率

### 11.2 必須提供的洞察（自動生成的中文短句，這是本 App 的差異化重點）

系統依規則觸發，每次最多顯示 3 條，附「立即特訓」按鈕：

| 觸發條件 | 產出洞察 |
|---|---|
| 慢速正確率 − 原速正確率 > 25% | 「你聽得懂，但反應速度跟不上。建議把常用語速調到 1.0× 以上，並多練 Section 1 快打。」 |
| `heard-misspelled` 佔錯誤 > 40% | 「你的耳朵沒問題，問題在拼字。已為你建立 12 張拼字專練卡。」 |
| 某口音正確率低於平均 15% | 「澳式口音是你目前最大的失分來源（正確率 52%，其他口音平均 74%）。」 |
| `trap` 佔錯誤 > 20% | 「你容易被說話者的自我更正騙到。建議做陷阱密度『高』的專練。」 |
| S4 正確率比 S1 低 20%+ | 「長篇學術講座是主要瓶頸，問題通常不是單字而是跟不上結構。建議開啟訊號詞雷達。」 |
| 使用者自選原因與系統推測落差 > 30% | 「你常認為自己『沒聽到』，但實際多半是拼字錯誤 —— 你的聽力比你以為的好。」 |
| 連續 3 天未練 | 「已中斷 3 天，建議先做 10 分鐘複習找回手感。」 |

### 11.3 其他視圖
- 熱力圖日曆（每日練習量）。
- skillTag 明細表，可排序，點擊即進入該 tag 的專練。
- 模考 Band Score 趨勢線 + 目標線（使用者可設定目標 6.5 / 7.0）。

---

## 12. 遊戲化（低壓力設計）

- 連續天數（streak）+ **每月 2 次「護盾」**自動抵銷中斷（避免焦慮式使用）。
- 每日任務：3 選 1（例：完成 15 題 / 清空複習 / 練 10 分鐘澳式），完成給徽章進度。
- 成就徽章：首次模考、Band 7 達成、清空 100 張複習卡、5 種口音全部 80%+、連續 30 天。
- **不做排行榜、不做好友、不做社群比較**（需求方指定，且此族群壓力已高）。
- 所有遊戲化元素可在設定中一鍵全關（`minimalMode`）。

---

## 13. Claude API 選配整合（`core/ai/`）

### 13.1 原則
- **完全選配**。無 API key 時，整個功能區塊顯示為「未啟用」，App 其餘功能 100% 正常。
- API key 只存在本機 `localStorage`（設定頁可輸入 / 清除），**絕不上傳任何地方**。
- 直接從瀏覽器呼叫，需帶 header `anthropic-dangerous-direct-browser-access: true`。
- 設定頁必須明示：「此金鑰僅存於本機瀏覽器。使用此功能會產生 Anthropic API 費用，由你自行負擔。」
- 生成的題目 `source: 'ai-generated'`，在題庫中以標籤區分，**預設不納入模考**（品質未經人工驗證）。

### 13.2 出題 System Prompt（直接使用）

```
You are an IELTS Listening content author. You produce ORIGINAL practice material.

ABSOLUTE RULES:
- Never reproduce, paraphrase, or adapt any text from Cambridge IELTS books,
  official IELTS practice tests, or any published copyrighted material.
  All scripts must be freshly invented.
- Output MUST be a single valid JSON object matching the provided schema.
  No markdown fences, no commentary, no preamble.

AUTHORING REQUIREMENTS:
- Write natural spoken English with the features of real speech: contractions,
  fillers (well, actually, I mean), hesitations, self-corrections, and
  interruptions. Do NOT write textbook-clean prose.
- Section 1: transactional dialogue, 2 speakers, everyday context
  (booking, enquiry, registration, complaint).
- Section 2: monologue or guided tour, one speaker, non-academic public context.
- Section 3: academic discussion, 2-4 speakers (usually 2 students + 1 tutor).
- Section 4: academic lecture monologue, single speaker, no interruptions.
- Every answer must appear VERBATIM in the transcript.
- Each blank must have a paraphrase relationship between the question wording
  and the audio wording. Never let the question reuse the exact audio phrasing.
- Include at least one distractor per 4 questions: a plausible wrong answer
  that is mentioned then corrected, negated, or attributed to someone else.
- Respect the word limit stated for each blank.
- Assign accurate skillTags to every blank.
- Speaker accents must match the requested distribution.
- Target the requested difficulty (1=very easy, 5=Band 8+).

The user will specify: section, topic, difficulty, accent mix, number of blanks,
and optionally a list of skillTags to focus on (derived from the learner's
weakness profile).
```

### 13.3 回應 JSON Schema

```json
{
  "type": "object",
  "required": ["title","topic","section","difficulty","speakers","lines","blanks"],
  "properties": {
    "title": {"type":"string"},
    "topic": {"type":"string"},
    "section": {"type":"integer","minimum":1,"maximum":4},
    "difficulty": {"type":"integer","minimum":1,"maximum":5},
    "speakers": {
      "type":"array","minItems":1,"maxItems":4,
      "items":{"type":"object",
        "required":["id","label","accent","gender"],
        "properties":{
          "id":{"type":"string"},
          "label":{"type":"string"},
          "accent":{"enum":["en-GB","en-AU","en-US","en-CA","en-NZ"]},
          "gender":{"enum":["M","F"]}
        }}
    },
    "lines": {
      "type":"array","minItems":8,
      "items":{"type":"object",
        "required":["speaker","text"],
        "properties":{
          "speaker":{"type":"string"},
          "text":{"type":"string"},
          "pauseAfter":{"type":"integer"}
        }}
    },
    "blanks": {
      "type":"array","minItems":3,"maxItems":10,
      "items":{"type":"object",
        "required":["id","questionText","answers","maxWords","skillTags"],
        "properties":{
          "id":{"type":"string"},
          "questionText":{"type":"string"},
          "answers":{"type":"array","items":{"type":"string"},"minItems":1},
          "maxWords":{"type":"integer","minimum":1,"maximum":3},
          "numeric":{"type":"boolean"},
          "skillTags":{"type":"array","items":{"type":"string"}},
          "paraphraseNote":{"type":"string",
            "description":"題目用詞 vs 音檔用詞的對應說明"}
        }}
    },
    "traps": {
      "type":"array",
      "items":{"type":"object",
        "required":["decoy","correct","explanation"],
        "properties":{
          "decoy":{"type":"string"},
          "correct":{"type":"string"},
          "explanation":{"type":"string"}
        }}
    }
  }
}
```

### 13.4 生成後的本機校驗（**不可略過**）

生成結果必須通過 `validateGenerated()` 才可入庫，任一項失敗則顯示問題並提供「重新生成」：
1. JSON 可解析且符合 schema。
2. 每個 `answers[0]` 在 lines 拼接後的 transcript 中**完全出現**。
3. 答案字數 ≤ `maxWords`。
4. `questionText` 不得包含答案本身，且不得與音檔原句逐字相同（做 3-gram 重疊檢測，重疊率 > 60% 判失敗）。
5. 答案間無重複。
6. speaker id 在 lines 中皆有定義。
7. 總字數落在合理範圍（S1: 700–1100；S2: 700–1000；S3: 900–1300；S4: 900–1300）。

### 13.5 弱點導向生成
「依我的弱點出題」按鈕：讀取 analytics，自動組出 user prompt，例如：
> section 3, difficulty 4, accents: en-AU 60% / en-GB 40%, 8 blanks, focus skillTags: [paraphrase, self-correction, academic-vocab]

---

## 14. 視覺設計方向

**不要做成又一個藍色圓角 SaaS 儀表板。** 這是一個「專注 + 高強度輸入」的工具，設計要服務於長時間戴耳機盯螢幕打字。

- **氛圍**：類似專業錄音室 / 聽打軟體。沉穩、低飽和、資訊密度高但呼吸感足。
- **色彩**：以暖中性灰（非純黑白）為底。深色模式為**預設**（長時間使用護眼）。
  - 主色：琥珀 / 芥末黃系（`--accent`），呼應「音訊軟體」的視覺語彙，避開學習 App 的藍綠俗套。
  - 語意色：正確 = 青綠（非亮綠）、錯誤 = 磚紅（非警示紅）、提示 = 灰紫。
  - `colorBlindSafe` 開啟時，正確/錯誤改用**藍/橘**並加上圖示（✓ / ✗），不單靠顏色傳達。
- **字體**：
  - 介面：`Inter` / 系統字。
  - **作答與逐字稿：等寬字體（`JetBrains Mono` 或系統 mono）** —— 拼字比對時等寬能讓字母級 diff 對齊，這是功能性選擇不是風格選擇。
  - 中文：`Noto Sans TC`。
- **排版**：作答區永遠置於視覺中心，播放器固定於下方 thumb zone（手機）或上方（桌面）。
- **動效**：克制。只在三處使用 —— 語速刻度吸附脈衝、對答時的答案揭示（150ms fade）、卡拉 OK 高亮推進。**不做頁面轉場動畫**（會拖慢高頻練習的節奏感）。
- **觸控目標**：所有可點元素 ≥ 44×44pt。
- 全域 CSS Variables 主題，切換 light/dark/colorBlindSafe 不需重載。

---

## 15. 無障礙

- 全鍵盤可操作，焦點環清晰可見（不可 `outline: none`）。
- 所有互動元素有 `aria-label`；播放器狀態變化用 `aria-live="polite"` 播報。
- 字級 5 級調整（0.875× – 1.5×），版面不得破版。
- 深色模式對比度 ≥ WCAG AA（4.5:1）。
- 動效尊重 `prefers-reduced-motion`。
- 逐字稿可調行高與字距（聽打者常見需求）。

---

## 16. 離線與資料管理

- Workbox：App Shell 用 precache，音檔用 CacheFirst + 明確過期策略（不自動清除已下載 pack）。
- 啟動時 `navigator.storage.persist()` + 顯示配額使用量。
- 設定頁提供：
  - **匯出全部資料**（JSON，含 attempts / srs / vocab / settings）→ 觸發下載，iOS 可存到「檔案」App 或 iCloud Drive。
  - **匯入資料**（含衝突處理：以較新 timestamp 為準）。
  - **重設進度**（需輸入 `RESET` 確認）。
  - **管理題庫包**（各 pack 大小、刪除、重新下載）。
- 離線狀態偵測：離線時把 Claude API 功能區灰階並顯示「需要網路」。

---

## 17. 種子題庫要求（Phase 3 交付）

| 模式 | 數量 | 備註 |
|---|---|---|
| 句級聽寫素材 | 500 句 | 涵蓋 5 種口音，難度 1–5 分布均勻 |
| Section 1 完整題組 | 10 篇 | 每篇 10 題 |
| Section 2 完整題組 | 10 篇 | 其中 4 篇含地圖題 |
| Section 3 完整題組 | 10 篇 | 每篇至少 3 位說話者 |
| Section 4 完整題組 | 10 篇 | 每篇 5–7 分鐘 |
| 模考套組 | 3 套 | 由上述題組組合，標記為 mock-only 避免練習時劇透 |
| 口音特訓組 | 40 句 × 5 口音 | 共 200 個音檔 |

**主題分布**（避免全部集中在校園場景）：住宿、旅遊預訂、圖書館、社團報名、健身房、博物館導覽、城市導覽、活動說明、研究討論、論文指導、實驗設計、小組報告分工、環境科學、心理學、建築史、海洋生物、都市規劃、食品科技。

Phase 3 可先交付 **每類 2 篇 + 100 句聽寫** 作為可驗證的最小內容集，其餘以腳本批次生成。

---

## 18. 開發階段

**Phase 1 — 骨架與播放器（先讓一種模式完整跑通）**
專案初始化、設計系統、Dexie schema、AudioEngine、AudioPlayer（含語速磁吸滑桿與 haptic 降級鏈）、模式 ① 句級聽寫、判分引擎、失分歸因、結果頁、TranscriptViewer、10 句種子內容。
> 驗收：能在 iPhone 主畫面安裝、離線完成 10 句聽寫、看到逐字稿與診斷。

**Phase 2 — 內容管線**
`generate-audio.ts` / `build-timings.ts` / `validate-content.ts`、pack 分包與按需下載、匯出匯入。
> 驗收：一行指令從 YAML 生出音檔 + 時間戳 + pack.json，且逐詞高亮對得準。

**Phase 3 — 全部模式 + 內容**
模式 ②③④⑨ → ⑤⑥⑦⑧；種子題庫。
> 驗收：9 種模式皆可完整作答與檢討；模考可跑完 30 分鐘。

**Phase 4 — 學習系統**
SM-2、複習頁、弱點分析與自動洞察、生字本 / Paraphrase 本 / 難句本、遊戲化。

**Phase 5 — Claude API 選配 + 打磨**
AI 出題與校驗、無障礙全檢、效能、GitHub Pages 部署設定。

---

## 19. 驗收標準（每個 Phase 結束自檢）

### 功能
- [ ] iPhone Safari「加入主畫面」後，**開飛航模式**仍可完成一次完整練習
- [ ] 9 種模式皆可作答、送出、看回饋、進入逐字稿
- [ ] 語速滑桿 0.50–3.00 連續可調，9 個刻度有吸附與可感知回饋（含 iOS 降級路徑）
- [ ] 模考模式：語速鎖定 1.0×、無法暫停 / 倒回 / 重播，計時準確，2 分鐘檢查時間
- [ ] 公布解答 → 該題 0 分 + 隔日強制複習（在 DB 中可驗證 `forcedTomorrow: true`）
- [ ] 拼錯判定為錯，且顯示字母級 diff
- [ ] `15` 與 `fifteen` 皆判對；`St` 與 `Street` 皆判對；`car-park` 與 `car park` 判定不同
- [ ] 複數 s 錯誤判為錯
- [ ] 逐詞卡拉 OK 高亮與音檔誤差 < 150ms
- [ ] 失分歸因彈窗有系統預選，資料進入 analytics
- [ ] 弱點分析至少能觸發 3 條自動洞察，且「立即特訓」能正確帶參數跳轉
- [ ] 無 API key 時，App 全功能可用（僅 AI 出題區塊停用）
- [ ] 匯出 JSON → 清空資料 → 匯入 → 進度完全還原

### 品質
- [ ] TypeScript `strict` 無錯、無 `any`（第三方型別缺失除外，需註記）
- [ ] 判分引擎單元測試覆蓋率 ≥ 90%（含所有正規化規則的邊界案例）
- [ ] Lighthouse PWA 100 / Performance ≥ 90
- [ ] 首屏可互動 < 2s（4G 模擬）
- [ ] 鍵盤全操作可完成一次聽寫（不碰滑鼠）
- [ ] `prefers-reduced-motion` 生效
- [ ] 字級調到 1.5× 無破版
- [ ] 無任何來源不明或有版權疑慮的文本 / 音檔

### 內容
- [ ] `validate-content.ts` 全數通過
- [ ] 口音配比 GB40/AU20/US20/CA10/NZ10 誤差 ≤ ±5%
- [ ] 每個 skillTag 至少 15 題
- [ ] 每個答案在 transcript 中可被定位

---

## 20. 明確的「不要做」清單

- 不要做帳號系統、登入、雲端同步
- 不要做排行榜、社群、好友比較
- 不要做付費牆、訂閱、廣告
- 不要做影子跟讀與發音評分（v2 再議，需語音辨識成本）
- 不要引用任何劍橋雅思或官方真題內容
- 不要用 `speechSynthesis` 當主要音源
- 不要在作答輸入框開啟 autocorrect / autocapitalize
- 不要因為 iOS 不支援震動就靜默略過回饋
- 不要做頁面轉場動畫
- 不要把 API key 送到任何第三方或寫進 repo
