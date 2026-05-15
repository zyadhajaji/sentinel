# Sentinel Terminal — Frontend Reference

> Complete visual and architectural documentation for the Sentinel Terminal frontend.  
> Stack: React 19 · Vite 6 · TypeScript 5.7 · Tailwind CSS 3.4  
> Deployed: https://sentinel-terminal.vercel.app

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Design System](#3-design-system)
4. [Application Shell](#4-application-shell)
5. [Tab: Terminal](#5-tab-terminal)
6. [Tab: Bot](#6-tab-bot)
7. [Tab: Portfolio](#7-tab-portfolio)
8. [Tab: Calendar](#8-tab-calendar)
9. [Modals & Overlays](#9-modals--overlays)
10. [Signal Scoring Engine](#10-signal-scoring-engine)
11. [Strategy Engine](#11-strategy-engine)
12. [Bot Modes: Paper vs Live](#12-bot-modes-paper-vs-live)
13. [Data Sources & Live Updates](#13-data-sources--live-updates)
14. [State Management](#14-state-management)
15. [Deployment & Demo Mode](#15-deployment--demo-mode)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (Concurrent Mode) |
| Build tool | Vite 6 |
| Language | TypeScript 5.7 (strict, `noUnusedLocals`, `noUnusedParameters`) |
| Styling | Tailwind CSS 3.4 + custom CSS variables |
| Fonts | Space Grotesk (display) · JetBrains Mono (mono) · Inter (body) |
| Wallet | `@solana/wallet-adapter-react` — Phantom + Solflare |
| Routing | None — tab state via `useState` in App.tsx |
| Charts | Pure SVG (no external chart libraries) |
| Persistence | `localStorage` via typed `loadStorage` / `saveStorage` helpers |

---

## 2. Project Structure

```
src/
├── App.tsx                         # Root shell, tab routing, global state wiring
├── main.tsx                        # React DOM entry point
├── index.css                       # Design tokens, resets, animations
│
├── types/
│   ├── index.ts                    # Signal, ScoreBreakdown, ScoreGrade types
│   └── backtest.ts                 # Strategy, Position, StrategyStats, StrategyFilters
│
├── contexts/
│   ├── AdminContext.tsx            # Profile, fake balance, admin unlock state
│   └── WatchlistContext.tsx        # Global watchlist set
│
├── hooks/
│   ├── useSignalFeed.ts            # PumpFun WS + DexScreener polling + rug enrichment
│   ├── useBacktest.ts              # Bot engine: signal → position lifecycle
│   ├── useSolPrice.ts              # Live SOL/USD price
│   └── useWalletBalance.ts         # Phantom wallet SOL balance
│
├── lib/
│   ├── scoreEngine.ts              # Signal scoring algorithm (v2, research-backed)
│   ├── strategyEngine.ts           # Strategy presets, entry eval, exit processing
│   ├── narrativeEngine.ts          # Token name → narrative tag detection
│   ├── dexscreener.ts              # DexScreener API client
│   ├── pumpfun.ts                  # PumpFun WebSocket client
│   ├── rugcheck.ts                 # RugCheck API client
│   ├── jupiter.ts                  # Jupiter swap integration
│   ├── alertEngine.ts              # Browser + audio alert triggers
│   ├── storage.ts                  # Typed localStorage helpers
│   ├── appMode.ts                  # IS_DEMO flag + storage key prefixer
│   └── mockData.ts                 # Demo signal generation
│
├── components/
│   ├── Header.tsx                  # Top navigation bar
│   ├── SignalFeed.tsx              # Main signal list with filters
│   ├── TokenCard.tsx               # Individual signal card
│   ├── TradePanel.tsx              # Right-side trade execution panel
│   ├── TokenDetailModal.tsx        # Full token detail overlay
│   ├── ScoreBreakdownPanel.tsx     # Score bar chart breakdown
│   ├── ScoreRing.tsx               # Circular score ring widget
│   ├── ProfileModal.tsx            # User profile editor (avatar + username)
│   ├── PnlCard.tsx                 # Axiom-style PnL share card generator
│   │
│   ├── backtest/
│   │   ├── BacktestPage.tsx        # Bot tab: status bar + strategy grid + positions
│   │   ├── StrategyCard.tsx        # Individual strategy card with controls
│   │   ├── StrategyEditor.tsx      # Full strategy filter/exit editor modal
│   │   ├── PositionTable.tsx       # Open/closed positions table
│   │   └── PatternIntelPanel.tsx   # Pattern analysis intelligence panel
│   │
│   ├── portfolio/
│   │   └── PortfolioDashboard.tsx  # Portfolio tab: donut, chart, positions, calendar
│   │
│   ├── calendar/
│   │   └── CalendarPage.tsx        # 7D / 30D / 3M trade calendar views
│   │
│   └── admin/
│       └── AdminPanel.tsx          # Hidden admin controls (5-tap unlock)
│
└── providers/
    └── WalletProviders.tsx         # Solana wallet adapter setup
```

---

## 3. Design System

### Color Palette

All colors defined as CSS custom properties in `index.css` and mirrored in `tailwind.config.js`.

**Surfaces (darkest → lightest)**
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#080808` | Page background, header, nav |
| `--surface-1` | `#0f0f0f` | Cards, panels |
| `--surface-2` | `#141414` | Nested surfaces |
| `--surface-3` | `#1a1a1a` | Hover states, inputs |

**Borders**
| Token | Hex |
|---|---|
| `--border-1` | `#1a1a1a` |
| `--border-2` | `#252525` |
| `--border-3` | `#333333` |

**Text**
| Token | Hex | Role |
|---|---|---|
| `--text` | `#e6e6e6` | Primary text |
| `--text-2` | `#999999` | Secondary labels |
| `--text-3` | `#555555` | Muted / disabled |
| `--text-4` | `#333333` | Dim decorative |

**Brand Accents**
| Name | Hex | Usage |
|---|---|---|
| Cyan | `#00d4ff` | Primary interactive, live status, BOT indicator |
| Green | `#00ff88` | Positive PnL, wins, SAFE grade, LIVE status |
| Red | `#ff3355` | Negative PnL, losses, RISK grade, SL exits |
| Gold | `#ffd700` | ANAKIN strategy, admin-unlocked state |
| Amber | `#ffcc00` | WATCH grade, timeout exits |
| Orange | `#ff8c00` | Volume Surge strategy, surge animation |
| Purple | `#8b5cf6` / `#7c3aed` | Social Alpha, Narrative Play, portfolio donut, PnL cards |

### Typography

Three font families loaded from Google Fonts:

| Family | Weight | Usage |
|---|---|---|
| **Space Grotesk** | 500 / 600 / 700 | Logo "SENTINEL", display headings — class `font-display` |
| **JetBrains Mono** | 400 / 500 / 600 | All data: prices, scores, addresses, labels — class `font-mono` |
| **Inter** | 400 / 500 / 600 / 700 | Body text, modals, form inputs — class `font-sans` |

Font sizes used: `9px` (micro labels) → `10px` (card data) → `11px` (table) → `12px` (secondary) → `13px` (primary) → `14px` (base) → `16–32px` (headings/balance).

### Spacing & Radius

4px grid system: `--sp-1: 4px` through `--sp-10: 40px`.

Border radii: `--r-sm: 6px` · `--r-md: 10px` · `--r-lg: 14px` · `--r-xl: 18px`  
Tailwind equivalents: `rounded` / `rounded-lg` / `rounded-xl` / `rounded-2xl`.

### Animations

| Class | Effect | Duration |
|---|---|---|
| `animate-pulse-green` | Green pulse ring glow | 2.5s infinite |
| `animate-fade-in` | Opacity 0→1 + translateY -4px→0 | 200ms ease-out |
| `animate-slide-up` | Opacity 0→1 + translateY 8px→0 | 200ms ease-out |
| `animate-surge` | Gold/orange glow pulse on hot token cards | 2.5s infinite |
| `animate-moon` | Purple glow pulse on moonbag cards | 3s infinite |
| `animate-launch` | Green border pulse on instant launches | 1.5s infinite |

All animations disabled under `prefers-reduced-motion`.

### Scrollbars

Desktop: 3px wide, transparent track, `#333333` thumb.  
Mobile: completely hidden (`scrollbar-width: none`).

### Touch Targets

All interactive elements: minimum `44×44px` hit area (`min-h-[44px]` / `min-w-[44px]`).  
Buttons use `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent`.

---

## 4. Application Shell

### App.tsx Architecture

Three-level component hierarchy:

```
WalletKeyBridge          ← reads useWallet(), feeds walletKey to AdminProvider
  └── AdminProvider      ← profile state, fakeBalance, per-wallet localStorage
        └── AppCore      ← calls useAdmin() + useBacktest() + all UI state
```

### Header (56px tall, full width)

**Left side**
- Logo button (28×28px rounded square): lightning bolt SVG icon
  - Cyan border/bg normally (`#00d4ff30`)
  - Gold border/bg when admin unlocked (`#ffd70040`)
  - 5-tap within 3 seconds → unlocks admin panel
  - Gold shield badge appears when unlocked
- "SENTINEL" in Space Grotesk bold 13px
- "TERMINAL" in JetBrains Mono 9px dim (hidden on mobile)
- `DEMO` chip (gray, `#444`) when `VITE_APP_MODE=demo`

**Center**
- Feed status dot: green pulse = LIVE, red = connecting
- "LIVE" / "connecting" text (hidden on mobile)
- BOT status dot: cyan pulse when running, with open position count
- SOL price: `$XXX` in white (hidden on mobile)

**Right side**
- Profile avatar (32×32px circle): first 2 chars of username, border + text in `avatarColor`
- Wallet button: shows truncated public key or "CONNECT", cyan border style, min 44px height

### Tab Navigation

**Desktop** (hidden on mobile): horizontal pill bar below header
- TERMINAL · BOT · PORTFOLIO · CALENDAR
- Active tab: `bg-[#141414]` + `border-[#2a2a2a]`
- Inactive: `text-[#555555]` with hover to `#888888`
- BOT tab shows open position count in cyan

**Mobile** (fixed bottom, 56px + safe area): 4-item bottom nav
- TERMINAL (terminal icon) · BOT (robot icon) · PORTFOLIO (bar chart icon) · CALENDAR (calendar icon)
- Active: `text-[#00d4ff]`
- Inactive: `text-[#444444]`
- BOT shows circular count badge when positions open

---

## 5. Tab: Terminal

**Layout**: Two-column on desktop (signal feed | trade panel), single column on mobile.

### Signal Feed (SignalFeed.tsx)

**Filter bar** (sticky top)

*MC Tier tabs* — 5 options:
| Tab | Color | Condition |
|---|---|---|
| ALL | white | show everything |
| SAFE | `#00ff88` green | `mcap_usd ≥ $500K` |
| WATCH | `#ffcc00` amber | `mcap_usd ≥ $7K` |
| RISK | `#ff3355` red | `mcap_usd < $7K` OR `age ≤ 5min` |
| ★ STARRED | amber star | in watchlist |

Active tab shows MC hint (e.g. `≥$500K`) + signal count below the search bar.

*Search bar* — filters by token symbol, name, or contract address (case-insensitive). Clear button (×) appears when text present.

**Active filter pill** — when a tier is selected, shows: tier label + MC range + count (`12 signals`).

**Signal list** — scrollable, max 50 signals, newest first. New signal animates in with flash highlight for 1.5s.

**Empty states**:
- No signals yet: scanner icon + "Scanning the market..." loading message
- Search no results: search icon + "No tokens match your search"
- Starred empty: star icon + "No starred tokens yet"

### Token Card (TokenCard.tsx)

Each card is a dark bordered box with contextual animations:

**Header row**
- Token image (24px circle, fallback to colored initials)
- Token name (bold) + symbol (dim)
- Source protocol pill: `PUMP` / `RAY` / `MOON` with protocol color
- Score ring (SVG circle, colored by grade) with score number
- Grade badge: `SAFE` green · `WATCH` amber · `RISK` red
- Narrative pills (up to 2): colored by narrative type (AI=purple, MEME=orange, ANIMAL=cyan, etc.)

**MC row** (live updating)
- If MC has changed >1% since signal was first detected:
  `CALLED $45K → LIVE $67K (+49%)` — entry MC in dim gray, current MC white, % in green/red
- Otherwise: single `MC $67K` display

**Data row**
- Age: `5m` / `2h 30m`
- Contract address (truncated, monospace)
- Holders count if available: `1,234 holders`

**Stats row**
- Liquidity: `$45K`
- Buy pressure: `72%` (green if ≥65%, amber if ≥50%, red otherwise)
- Volume 1h: `$12.3K`

**Social pills** (colored branded pills with icons)
- Twitter/X: `#1D9BF0` blue, shows `@handle`
- Telegram: `#229ED9` blue, shows `t.me/channel`
- Website: `#6b7280` gray, shows domain
- DEX Chart: `#9945ff` purple, shows "Chart"

**Rug indicators** (when rug data available)
- RugCheck score badge (0-1000)
- Risk tags: `FREEZE AUTH` / `MINT AUTH` / `HIGH CONCENTRATION` etc. in red pills

**Action buttons**
- `TRADE` — opens trade panel
- `DETAIL` — opens full detail modal
- Star/unstar button (watchlist toggle)

**Card animations** based on token characteristics:
- `animate-surge` — buy pressure >80% AND price change >50%
- `animate-moon` — age >1h AND score ≥70
- `animate-launch` — age <2min (instant launch)

### Trade Panel (TradePanel.tsx, desktop only)

Right side 320px panel showing when a signal is selected:
- Token info header
- Buy amount input (SOL)
- Jupiter swap integration
- Slippage setting
- Estimated output

---

## 6. Tab: Bot

**Layout**: vertical stack — status bar → strategy grid → position table

### ANAKIN Status Banner

Full-width top row above the stat strip:
- Gold pulsing dot
- **ANAKIN** in bold gold (`#ffd700`)
- **ONLINE** in green (`#00ff88`)
- `· 24/7 SCANNING` in dim gray
- `last scan Xs ago` — live counter updating every second

### Bot Status Strip (scrollable horizontal)

Pill cells separated by `#1a1a1a` dividers:
- **BOT ACTIVE** — cyan pulse dot + "ACTIVE" label
- **Session** — total trade count this session
- **Open** — currently open position count (cyan when > 0)
- **P&L** — total PnL SOL (green/red colored)
- **Last trade** — time ago string
- **Win Rate** — overall % (green ≥50%, red <50%)
- **Best** — highest single trade PnL in green

### Strategy Grid

Cards for all strategies (2 columns on tablet+, 1 column mobile).

Each **StrategyCard** shows:
- Colored left border (strategy color)
- Strategy name + description
- **PAPER** (gray pill) or **LIVE** (green pill) badge
- Win rate ring + trade count
- PnL in SOL (colored)
- Position size (SOL) with +/- stepper
- Auto-trade toggle (labeled, not just an icon)
- Edit button (opens StrategyEditor)
- Delete button (custom strategies only)

**Locked strategies** (ANAKIN, Alpha Seeker, etc.) cannot be deleted or structurally edited — only position size and auto-trade toggle are changeable.

### Position Table (PositionTable.tsx)

Table/card list of all bot-managed positions.

**Filter tabs**: All · Open · Closed

**Columns** (responsive — some hidden on mobile):
- Status chip: `LIVE` cyan · `TP` green · `SL` red · `TIME` amber · `RUG` red
- **PAPER** / **LIVE** mode badge
- Token name + symbol
- Strategy name chip (colored)
- Entry price + entry MC
- Current PnL % (colored)
- PnL SOL (colored, tabular-nums)
- Hold time
- DEX link icon

---

## 7. Tab: Portfolio

**Sub-tabs** (sticky bar, purple underline indicator): Overview · Chart · Open · History · Calendar

### Overview Sub-tab

**Portfolio Donut** (center piece, 210×210px)
- SVG ring: track `#1e1e1e`, fill arc with linear gradient `#7c3aed → #6366f1 → #00d4ff`
- Arc fills to win rate % (max 85% of circumference)
- Glowing dot at arc end
- SVG `feGaussianBlur` filter for glow on the arc
- Center content (click to toggle SOL ↔ USD):
  - Label: "Solana balance" / "USD value"
  - Balance: large bold tabular number
  - Secondary: the other currency
  - Paper PnL: `+0.142 SOL paper` (if any)
  - "tap to switch" dim hint

**Long-press (500ms) on donut** → opens hidden balance override input (paper trade mode)

**Stat chips** (horizontal row below donut):
- Available: `fakeBalance - capitalAtRisk` SOL (dim green when set)
- At risk: open position capital in SOL
- Win rate %

**Action buttons** (2×2 grid)
- **Deposit** (purple) — modal with wallet address + copy button + "only send SOL on Solana network" note
- **Withdraw** (red) — informational modal with balance + Phantom wallet guidance
- **Send** (cyan) — stub
- **Receive** (green) — stub

**Allocation Donut** (multi-segment)
- One arc per strategy, gap of 0.06 radians between segments
- Colors match strategy colors
- Legend: strategy name · PnL · trade %

**Recent Trades** (last 5, transaction-row style)
- Token circle (strategy color initial)
- Token name + strategy chip + hold time
- PnL right-aligned (colored)
- Share icon → opens PnL Card Generator

### Chart Sub-tab

**Area chart** (pure SVG, 320×130 viewBox)
- Time range selector: `1D · 1W · 1M · ALL`
- Smooth bezier curve (`C cpx py cpx cy cx cy` path commands)
- Positive PnL: line `#a78bfa`, fill `#7c3aed`
- Negative PnL: line `#f87171`, fill `#dc2626`
- Current PnL label + mini stats (total trades, win rate, best/worst %)

### Open Positions Sub-tab

Position rows for all open bot positions with live PnL updating every 30s.

### History Sub-tab

All closed positions as transaction rows:
- Status chip + token + strategy + hold time + PnL
- Share icon button (14px upload SVG) on each row → opens PnL Card Generator

### Calendar Sub-tab

Embeds the full `CalendarPage` component (see [Tab: Calendar](#8-tab-calendar)).

---

## 8. Tab: Calendar

Three view modes toggled via pill tabs: **7D · 30D · 3M**

### 7D View — Hourly Heatmap

- 7 columns (days) × 24 rows (hours)
- Each cell: green tint (positive net PnL) or red tint (negative), intensity scales with magnitude
- Gray/dim = no trades in that hour
- Click a cell → drawer/panel shows all trades in that hour slot
- Day labels in header: Mon 12, Tue 13, etc.
- Hour labels every 6h on left: 00, 06, 12, 18
- Mobile: shows last 3 days only (first 4 columns hidden)

### 30D View — Weekly Grid

- Mon–Sun columns, one row per week
- Day cell: trade count chip (top-right), day PnL (colored number), win/loss/mixed dot
- Click a day → expands inline row beneath showing all trades as `TransactionRow` style

### 3M View — Weekly Summary Bars

- 13 weeks, most recent first, scrollable list
- Each week row: date range · trade count · win-rate fill bar · week PnL (colored)
- Click week → expands daily breakdown beneath

**Empty state**: centered icon + "No trades recorded yet — activate a bot strategy to start tracking."

---

## 9. Modals & Overlays

### Profile Modal (ProfileModal.tsx)

Bottom-sheet style overlay (slides up from bottom on mobile, centered on desktop):
- Avatar preview circle (64px) showing initials in selected color
- Username input (max 16 chars, auto-uppercase monospace)
- 6 color swatches: Cyan `#00d4ff` · Green `#00ff88` · Purple `#a855f7` · Orange `#ff9500` · Red `#ff3355` · Gold `#ffd700`
- Save button (cyan)
- Backdrop click to close

### Token Detail Modal (TokenDetailModal.tsx)

Full-screen overlay with:
- Token header (image, name, symbol, grade badge)
- Price + MC + liquidity stats
- Full score breakdown panel (ScoreBreakdownPanel)
- Social links
- Rug check details
- Trade button

### Admin Panel (AdminPanel.tsx)

Hidden panel — only visible after 5-tap logo unlock:
- Enable/disable all strategies
- Set global position size
- Clear all positions
- Fake balance control
- Session info

### PnL Card Generator (PnlCard.tsx)

Modal triggered by share icon on any closed position:

**Preview card** (resizable 280–520px × 160–320px):
- Token symbol large bold
- Entry MC → Exit MC (formatted K/M)
- PnL value (big, green/red) in SOL and/or USD based on currency setting
- PnL % badge (rounded pill, colored)
- Strategy name chip
- Hold time
- Entry date
- `SENTINEL` watermark (8px, 30% opacity, bottom-right)

**Settings panel**:

*Background*
- 6 gradient presets (dark purple, dark blue, black, dark green, dark red, charcoal)
- Custom color picker (`<input type="color">`)
- Blur slider 0–20px
- Opacity slider 0–1

*Text*
- Primary color picker (default `#e6e6e6`)
- Secondary color picker (default `#888888`)
- Shadow toggle (adds `text-shadow: 0 1px 4px rgba(0,0,0,0.8)`)
- Bold toggle

*Currency*
- Radio: SOL only · USD only · Both

*Layout*
- Width slider 280–520px
- Height slider 160–320px
- Reset to Defaults button

**Export actions**:
- **Export Card** — downloads `.svg` file
- **Copy to Clipboard** — writes SVG markup to clipboard, falls back to download

---

## 10. Signal Scoring Engine

**File**: `src/lib/scoreEngine.ts`  
**Research basis**: Memecoin Trading Ecosystem 2026 (§4.1, §4.3, §5.2, §7.2)

Signals are scored 0–100 across 6 weighted dimensions:

| Dimension | Max | Logic |
|---|---|---|
| **Buy Pressure** (`activity`) | 20 | ≥80%=20 · ≥70%=16 · ≥60%=12 · ≥55%=8 · <55%=0 |
| **Momentum** (`distribution`) | 10 | 1h price change: +100%=10 · +50%=9 · +20%=7 · +5%=4 |
| **Liquidity** | 20 | $100K+=20 · $50K+=17 · $25K+=13 · $10K+=8 · $3K+=3 |
| **Safety** (`authority`) | 20 | rug_score ≥800=15 · ≥600=11 · ≥400=6; +5 both auths revoked |
| **Age Window** (`age`) | 15 | 5-45min=15 · 45-120min=10 · 2-5min=6 · 2-4h=5 · <2min=2 |
| **Socials** | 15 | Twitter+TG+Website=15 · Twitter+TG=12 · Twitter+site=10 · Twitter=7 |

**Grade thresholds**:
- `SAFE` ≥ 70 (high-conviction signal)
- `WATCH` ≥ 45 (worth tracking)
- `RISK` < 45 (speculative / new launch)

**Live re-scoring**: after rug data arrives (~45s post-signal), the safety component updates and the card's score/grade refreshes live.

**Narrative detection** (src/lib/narrativeEngine.ts): scans token name + symbol against keyword lists for: AI · MEME · ANIMAL · GAMING · DEFI · CELEB · SPACE · FOOD · PATRIOT · SOLANA

---

## 11. Strategy Engine

**File**: `src/lib/strategyEngine.ts`

### Built-in Locked Strategies

| Strategy | Color | Target WR | Logic |
|---|---|---|---|
| **ANAKIN** | Gold `#ffd700` | ~92% | pump.fun, $15K+ liq, 68%+ buy pressure, 5-45min age, MC <$500K, TP +10%/+25%, SL -8%, 20min hold |
| **Alpha Seeker** | Cyan `#00d4ff` | ~72% | broader protocols, $8K+ liq, 58%+ buy pressure, 2-60min, TP +30%/+75%, SL -15% |
| **Safe Pocket** | Green `#00ff88` | ~93% | $30K+ liq, 72%+ buy pressure, 8-60min, TP +7%/+15%, SL -5%, 15min hold |
| **Moonbag** | Orange `#ff8c00` | ~42% | lottery tickets, $3K+ liq, age <8min, TP +100%/+300%, SL -30% |
| **Sniper** | Red `#ff3355` | ~55% | first-mover <2min, TP +20%/+100%, SL -20%, 30min |
| **Social Alpha** | Purple `#8b5cf6` | ~78% | requires Twitter + social, $10K+ liq, TP +50%/+150%, SL -20% |
| **Diamond Hands** | Cyan `#00d4ff` | ~38% | swing 5-10x, score ≥65, price change >20%, TP +200%/+500% |
| **Volume Surge** | Orange `#ff9500` | ~68% | buy pressure >70% + 1h change >15%, research §4.1 |
| **Narrative Play** | Purple `#a855f7` | ~73% | Twitter + narrative tag required, holds 90min, research §4.3 |
| **Rug Hunter** | Green `#00ff88` | ~88% | rug_score ≥600, $25K+ liq, safety-first, research §7.2 |

Locked strategies can only have `enabled`, `autoTrade`, and `positionSizeSol` modified.

### Exit Logic (processExits)

On each price tick (every 30s):
1. Check each take-profit level in ascending order
2. Sell `tp.sellPercent` of remaining position when hit
3. After all TPs hit → `closed_tp`
4. If unrealized PnL ≤ -90% → `closed_rug` (emergency exit)
5. If unrealized PnL ≤ `stopLossPct` → `closed_sl`
6. If hold time ≥ `maxHoldMinutes` → `closed_timeout`

---

## 12. Bot Modes: Paper vs Live

Every `Position` has `mode: 'paper' | 'live'`:

| Condition | Mode |
|---|---|
| Fake balance is set (long-press unlock) | `paper` |
| Strategy `autoTrade` is disabled | `paper` |
| `autoTrade` enabled + no fake balance | `live` |

**Paper mode**: positions tracked in localStorage, no on-chain transactions.  
**Live mode**: badge shown in green — actual trading would require Jupiter swap integration (autoTrade toggle enables this path).

Both modes show PAPER/LIVE chip on strategy cards and position rows.

---

## 13. Data Sources & Live Updates

| Source | Method | Interval | Data |
|---|---|---|---|
| PumpFun WebSocket | WebSocket (`wss://`) | Real-time | New token launches |
| DexScreener Profiles | REST poll | 20s | Token profiles for top signals |
| DexScreener Pairs | REST | On-demand | Price, MC, volume, txns for specific CA |
| RugCheck | REST | Once, 45s after detection | rug_score, risks, top holder % |
| SOL Price | REST | 30s | SOL/USD price for display |
| Position prices | DexScreener batched | 30s | Live PnL on open positions (5 CAs per batch) |
| Signal refresh | DexScreener | 90s | Re-fetch price/MC for visible signals |
| Watchlist CAs | DexScreener | 60s | Custom watched contract addresses |

**Signal lifecycle**:
1. PumpFun WS → instant signal created (basic score, no rug data)
2. +45s → DexScreener enrichment + RugCheck → score updates live
3. Every 90s → refresh cycle re-fetches price/MC for visible signals
4. `entry_mcap_usd` is frozen at step 1 and never overwritten

---

## 14. State Management

No external state library. All state via React hooks:

| State | Location | Persistence |
|---|---|---|
| Signals list | `useSignalFeed` (local) | None (session only) |
| Strategies config | `useBacktest` | `localStorage` |
| Positions | `useBacktest` | `localStorage` |
| Bot activity | `useBacktest` | `lastTradeTime` in localStorage |
| User profile | `AdminContext` | `localStorage` keyed by wallet address |
| Fake balance | `AdminContext` | Session only (not persisted) |
| Alert settings | `useSignalFeed` | `localStorage` |
| Watchlist CAs | `useSignalFeed` | `localStorage` |
| MC tier filter | `SignalFeed` | `localStorage` |
| Active tab | `App.tsx` | Session only |

**Per-wallet namespacing**: all localStorage keys use `sentinel_profile_{walletAddress}` (or `sentinel_profile_anon` when disconnected) so profiles are isolated per wallet.

**Demo mode prefix**: all keys prefixed with `demo_` when `VITE_APP_MODE=demo` to prevent cross-contamination with real deployment data.

---

## 15. Deployment & Demo Mode

### Production

```bash
npm run build   # tsc -b && vite build
npx vercel --prod --yes
```

Live URL: **https://sentinel-terminal.vercel.app**

Vercel config (`vercel.json`):
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Demo Mode

A second Vercel deployment can be created from the same repo with one environment variable:

```
VITE_APP_MODE = demo
```

This activates:
- `IS_DEMO = true` throughout the app
- `DEMO` chip in the header next to "SENTINEL"
- All localStorage keys prefixed with `demo_`
- `fakeBalance` pre-initialized to `12.5 SOL`
- All default strategies start `enabled: true`
- No wallet required to see portfolio

### Local Development

```bash
cd C:\Users\anakin\s-tier\sentinel-terminal
npm install
npm run dev          # http://localhost:5173
```

Environment variables (optional):
```
VITE_APP_MODE=demo   # enable demo mode locally
```

### TypeScript Check

```bash
npx tsc --noEmit
```

Config enforces `strict`, `noUnusedLocals`, `noUnusedParameters` — all must be zero errors before any commit.

---

*Last updated: May 2026 — Sentinel Terminal v0.1.0*
