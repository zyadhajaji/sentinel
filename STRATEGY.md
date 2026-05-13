# Sentinel Terminal — Build Strategy

> No timelines. This is what we replace, what we keep, what we add, and how it fits together.

---

## What This Replaces

The current stack (`seekr_style_bot.py`) is a 12,944-line single-file monolith.
Every feature — scraping, trading alerts, Twitter, payments, admin — is one class.
It cannot be tested, scaled, or safely extended. We are not refactoring it.
We are building the product it was trying to become.

---

## The Core Shift

| Old Model | New Model |
|---|---|
| Scrape @solearlytrending (owned by competitor SOUL Systems) | Your scanner bot is the signal source |
| Telegram-only delivery | Web terminal + Telegram + Discord |
| Manual SOL payment approval by admin | On-chain automated payment verification |
| SQLite single file | PostgreSQL (persistent) + Redis (real-time) |
| Monolith Python file | Separated services: Web, Bot, Scanner Bridge, Admin |
| Config = code change + restart | Config = admin panel, live, no restart |
| Referral fees only | Trading fees (0.7%) + subscriptions + referrals |

---

## What We Keep From the Old Bot

These are extracted and migrated, not rewritten:

- **RateLimiter logic** — sliding window rate limiter, clean, reusable
- **OllamaContentGenerator** — system prompts, content categories, voice are well-crafted
- **Database schema patterns** — alerts, subscriptions, discount codes, referral tables (redesigned for Postgres but same structure)
- **Content templates** (CTA, trending, relatable, rage bait) — moved to DB, editable in admin
- **Solana address extraction** — 7 regex patterns covering all URL formats (pump.fun, dexscreener, gmgn, etc.)
- **Referral commission logic** — recalculated but same math
- **Dexscreener API integration** — async httpx client, kept as a data module
- **Discount code system** — migrated to admin panel with UI

---

## What We Replace

### 1. Telethon Scraper → Scanner Bridge
- **Remove**: All Telethon session management, channel scraping, RickBurpBot/GMGNAI_bot message passing
- **Replace with**: Your scanner bot outputs signals via a local webhook or message queue
- **Why**: @solearlytrending is owned by SOUL Systems LLC (competitor). Scraping their channel gives them visibility into your activity and can be cut off at any time.
- **How it works**: Scanner bot → HTTP POST to `/api/scanner/ingest` → validated → broadcast pipeline

### 2. Manual Payment → On-Chain Verification
- **Remove**: `/approve <table> <id>` command, admin watching for payments manually
- **Replace with**: Helius webhook on your payment wallet address. Transfer confirmed on-chain → subscription activated automatically, zero human involvement
- **Fallback**: Stripe for users who want card payment (convert to SOL internally or keep as USD subscription)

### 3. SQLite → PostgreSQL + Redis
- **Remove**: `self.conn`, `self.cursor`, WAL mode SQLite file
- **Replace with**: 
  - PostgreSQL (Neon serverless) for all persistent data
  - Redis (Upstash) for rate limits, pub/sub, caching, real-time state
- **Why**: SQLite has no concurrent write support. The web terminal + bot + admin hitting the same DB simultaneously will corrupt it.

### 4. In-Memory Admin State → Proper Auth
- **Remove**: `self.admin_users` set (lost on restart), plaintext password in env, password logged to console (SECURITY ISSUE)
- **Replace with**: Admin accounts in DB with bcrypt passwords, session tokens, role-based permissions (superadmin, moderator, viewer)

### 5. Hardcoded Config → Admin Panel
Every hardcoded list in the current bot becomes a DB table managed via admin UI:
- Channel list (scrape sources, alert destinations)
- Content templates (all categories)
- Influencer tag list + cooldowns
- Topic cooldown timings
- Subscription tier pricing
- Referral commission rates
- Engagement post intervals
- Scanner filter definitions

### 6. Monolith → Separated Services
```
sentinel-terminal/
├── src/                    ← Next.js web terminal + admin panel
├── bot/                    ← Telegram bot (Python, cleaned up)
├── scanner-bridge/         ← Scanner input API + signal processor
└── docs/                   ← Architecture docs
```

---

## What We Add

### Web Terminal (New)
A non-custodial Solana trading interface. Users connect Phantom/Backpack. You construct the Jupiter swap transaction with your fee embedded (0.7%). User signs — you never hold funds.

Features:
- Live token feed (scanner signals + DexScreener WebSocket)
- Price chart (Lightweight Charts — TradingView open source)
- One-click buy/sell via Jupiter v6 API
- Scanner score on every token (your scanner's output)
- Portfolio view (wallet positions via Helius DAS)
- Win-rate dashboard (public + per-user)

### Admin Panel (New)
Full control panel. No code changes ever needed for config.

Sections:
- **Scanner Filters** — create named filter presets with conditions
- **Alert Styles** — template editor with live preview
- **Channel Manager** — Telegram/Discord channel routing
- **Content Library** — all Twitter templates, categories, cooldowns
- **Pricing Manager** — subscription tiers, discount codes, referral rates
- **Performance** — win-rate history, revenue metrics, alert log

### Scanner Filter Builder (New — Core Feature)
The admin can create named filter profiles:
```
Filter: "Safe Launch"
  - Min liquidity: $50,000
  - Max top holder %: 15%
  - Mint authority: Revoked
  - Contract age: > 30 minutes
  - Scanner score: ≥ 70

Filter: "Snipe Grade"
  - Min liquidity: $10,000
  - Pump.fun: New launch only
  - Scanner score: ≥ 85
  - Fast track: Yes
```
Filters can be assigned to channels: Main channel uses "Safe Launch", Premium uses "Snipe Grade".

### Alert Style Builder (New)
Templates are edited visually in admin, not in code. Variables like `{token_name}`, `{score}`, `{mcap}`, `{liquidity}`, `{holders}` are available. Preview renders before save.

### Win-Rate Tracking (New — Growth Engine)
Every alert is logged with:
- Token CA, price at alert time, market cap at alert time
- Scanner score at time of alert
- Price check at 1h, 4h, 24h (background job)
- Outcome: 2x, 5x, rug, flat
- Public leaderboard page: "Last 30 days: 71% hit 2x within 4h"

### Trading Fee Revenue (New)
Jupiter v6 `platformFeeBps: 70` embeds a 0.7% fee on every swap.
Beats SOUL's 1% standard / 2.5% snipe fees.
Non-custodial: zero custody liability.

---

## Architecture Overview

```
YOUR SCANNER BOT
      │
      ▼ HTTP POST (local webhook)
SCANNER BRIDGE  ──────────────────────────────────────┐
      │                                               │
      ▼                                               ▼
SIGNAL PROCESSOR                              ADMIN PANEL
  - Apply active filters                      - Filter builder
  - Score validation                          - Template editor
  - Dedup                                     - Channel routing
      │                                       - Pricing config
      ▼                                       - Win-rate dashboard
  Redis pub/sub
      │
      ├──────────────────┬──────────────────┐
      ▼                  ▼                  ▼
TELEGRAM BOT       DISCORD BOT        WEB TERMINAL
  - Premium alerts    - Same signals     - Live feed
  - Buy buttons       - Same routing     - Charts
  - Subscription      - Premium tier     - Trade execution
  - /commands                            - Portfolio
      │                                       │
      ▼                                       ▼
  PostgreSQL                         Jupiter v6 API
  (users, alerts,              (0.7% fee on every swap)
   subscriptions,
   win-rate history)
```

---

## Revenue Stack (What Changes)

| Source | Old | New |
|---|---|---|
| Referral fees (Trojan/Axiom) | ~$17/user/mo | Keep as passive layer |
| Subscription (scanner access) | $0 | $35–60/month |
| Trading fees | $0 | 0.7% per swap (non-custodial) |
| Scanner API (B2B) | $0 | Phase 2+ |

---

## Security Fixes (From Code Review)

All of these are broken in the current bot and fixed in the new build:

| Issue | Current State | Fixed |
|---|---|---|
| Admin password logged to console | ❌ Line 11366 prints `admin_secret` | bcrypt + zero logging |
| Hardcoded wallet address fallback | ❌ Line 1849 | Env var only, no fallback |
| Referral passwords stored plaintext | ❌ `ref_agents` table | bcrypt hashed |
| Admin state lost on restart | ❌ In-memory set | DB-backed sessions |
| SQL injection pattern (f-string tables) | ❌ Lines 2807, 12063+ | ORM / parameterized only |
| Manual payment no blockchain proof | ❌ `/approve` command | Helius on-chain webhook |
| Telethon session in env variable | ❌ Full account access | Eliminated (scanner replaces it) |

---

## What the New Bot Looks Like

The Telegram bot becomes a thin delivery client:
- Receives signal events from Redis pub/sub
- Formats and sends to the correct channels based on filter routing
- Handles subscription commands (`/subscribe`, `/status`, `/cancel`)
- No scraping, no payment logic, no AI generation inline
- Connects to the web terminal for advanced features

The bot is ~500 lines instead of 12,944.

---

## Data Sources

| Data | Source | Cost |
|---|---|---|
| Token prices + charts | DexScreener API | Free |
| New token launches | Pump.fun WebSocket | Free |
| On-chain analytics | Helius (RPC + DAS) | Free tier |
| Holder data | Birdeye | Freemium |
| Swap routing | Jupiter v6 | Free |
| Portfolio/balances | Helius DAS | Free tier |
| Rug detection | Your scanner (primary) | Proprietary |
| Payment verification | Helius webhook | Free tier |

---

## Deployment

```
Cloudflare Pages  ← Terminal (Vite SPA, static, global edge)
Vercel            ← Admin panel + landing page (Next.js SSR)
Railway/Fly.io    ← WebSocket backend + Telegram bot (persistent processes)
Upstash Redis     ← Pub/sub + rate limiting + cache
Neon PostgreSQL   ← All persistent data
Helius            ← Solana RPC + webhooks
Cloudflare        ← CDN + DDoS + Bot Management
```

---

## Admin Panel — Section Breakdown

### Scanner Filters
- List of named filter profiles
- Each filter: name, description, conditions (liquidity, holders, score, contract age, chain, source)
- Assign filter to channel (Main = Filter A, Premium = Filter B)
- Enable/disable per filter without restart

### Alert Styles
- Template editor: markdown with variable substitution
- Variables: `{token}`, `{ca}`, `{score}`, `{mcap}`, `{liquidity}`, `{holders}`, `{age}`, `{chain}`
- Live preview panel (renders exactly as Telegram will show it)
- Multiple styles per tier

### Content Library (Twitter)
- All template categories: relatable, rage bait, AI roast, educational, trending, CTA
- Add/edit/delete templates per category
- Set cooldown timings per category
- Influencer tag list: add/remove handles, set per-handle cooldown

### Channel Manager
- Add Telegram/Discord channels
- Assign filter profile per channel
- Set channel tier (free / premium / early access)
- Toggle channels on/off

### Pricing Manager
- Subscription tiers: name, price, duration, features
- Discount codes: create, set usage limit, expiry date, % or flat discount
- Referral rates: set commission % per tier
- View revenue by source

### Performance Dashboard
- Alert log: every signal sent, with scanner score, time, CA
- Win-rate table: 1h / 4h / 24h outcomes per alert
- Public win-rate badge (embeddable, auto-updates)
- Revenue breakdown: subscriptions, trading fees, referrals
- User metrics: active subscribers, churn rate, new signups
