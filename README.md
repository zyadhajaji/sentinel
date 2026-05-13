# Sentinel Terminal

> Solana trading intelligence terminal. Scanner-first. Non-custodial. Built to beat SOUL.

## Project Structure

```
sentinel-terminal/
├── src/                    ← Next.js 15 web app (terminal + admin)
│   ├── app/
│   │   ├── (terminal)/     ← Trading terminal UI
│   │   ├── (admin)/        ← Admin panel
│   │   └── api/            ← API routes (scanner ingest, webhooks, swaps)
│   ├── components/         ← UI components
│   ├── lib/                ← Utilities, DB client, API clients
│   ├── hooks/              ← React hooks
│   └── types/              ← TypeScript types
│
├── bot/                    ← Telegram bot (Python, ~500 lines)
│   ├── main.py             ← Entry point
│   ├── handlers/           ← Command handlers
│   ├── broadcaster.py      ← Signal → channel delivery
│   └── requirements.txt
│
├── scanner-bridge/         ← Scanner input + signal processor
│   ├── ingest.py           ← Receives scanner output
│   ├── filters.py          ← Applies admin-defined filters
│   └── pipeline.py         ← Routes to Redis pub/sub
│
└── docs/
    ├── STRATEGY.md         ← Full build strategy
    └── API.md              ← Internal API documentation
```

## Stack

### Terminal (src/terminal/) — Vite + React SPA
- **Framework**: Vite 6 + React 19 — SPA, not SSR. Trading UIs are client-side.
- **Styling**: Tailwind CSS, Orbitron + Space Mono fonts (same as SOUL)
- **Charts**: Lightweight Charts (TradingView open-source)
- **Real-time**: Binary WebSocket (arraybuffer/MessagePack) pre-loaded before React mounts
- **Trading**: Jupiter v6 API (0.7% fee embedded, non-custodial)
- **Wallet**: Solana Wallet Adapter (Phantom, Backpack, Solflare)
- **PWA**: manifest.json + iOS splash screens for every device (Padre pattern)
- **Deploy**: Cloudflare Pages (global edge, free)

### Admin Panel (src/admin/) — Next.js 15
- **Framework**: Next.js 15 App Router (SSR for SEO + auth)
- **Auth**: Privy.io or next-auth
- **Deploy**: Vercel

### Backend (backend/) — Node.js / Bun
- **WebSocket server**: `/_multiplex` + `/_heavy_multiplex` (Padre pattern)
- **Load balancing**: 2–4 servers depending on scale
- **Redis pub/sub**: Upstash for signal routing
- **Database**: Neon PostgreSQL
- **Deploy**: Railway or Fly.io (persistent, not serverless)

### Bot (bot/) — Python
- **Framework**: python-telegram-bot
- **Connects via**: Redis pub/sub (reads from backend)
- **Deploy**: Railway

### Data Sources
- DexScreener, Helius, Birdeye, Pump.fun WebSocket

### Payments
- Helius webhook (on-chain SOL auto-verify) + Stripe (card)

## Competitor Reference

SOUL Terminal (soulterminal.ai) — analyzed and mapped.
Their fees: 1–2.5%. Ours: 0.7%.
Their scanner: standard on-chain reader. Ours: proprietary.
Their signal source: their own channels. Ours: our own scanner.

Full analysis: see SOUL competitor memory file.
