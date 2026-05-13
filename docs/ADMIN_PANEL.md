# Admin Panel — Full Spec

The admin panel replaces every hardcoded config in the old bot.
No restart needed for any change. All config is live.

---

## 1. Scanner Filters

Create named filter profiles that control which signals reach which channels.

### Filter Schema
```
name:           string          "Safe Launch"
description:    string          "For main channel — verified launches"
active:         boolean         true/false (toggle without delete)

conditions:
  min_liquidity_usd:    number      e.g. 50000
  max_top_holder_pct:   number      e.g. 15
  mint_authority:       enum        revoked | retained | any
  freeze_authority:     enum        revoked | retained | any
  min_contract_age_min: number      e.g. 30
  min_scanner_score:    number      0–100
  source_filter:        array       ["pumpfun", "raydium", "all"]
  max_mcap_usd:         number      optional cap
  min_mcap_usd:         number      optional floor
  require_socials:      boolean     twitter/website must exist
```

### UI
- Filter list with enable/disable toggle
- Click to edit any filter
- "Test Filter" button — paste a CA, see if it would pass
- Channel assignment: drag filter onto channel card

---

## 2. Alert Style Builder

Control exactly how alerts look in Telegram/Discord.

### Available Variables
| Variable | Description |
|---|---|
| `{token_name}` | Token name |
| `{token_symbol}` | Ticker symbol |
| `{ca}` | Contract address |
| `{score}` | Scanner score 0–100 |
| `{score_badge}` | 🟢 SAFE / 🟡 WATCH / 🔴 RISK |
| `{mcap}` | Market cap formatted ($1.2M) |
| `{liquidity}` | Liquidity formatted ($85K) |
| `{holders}` | Holder count |
| `{top_holder_pct}` | Top holder % |
| `{age}` | Contract age (e.g. "42 min") |
| `{source}` | Where it came from (pumpfun, raydium) |
| `{chart_url}` | DexScreener link |
| `{buy_url}` | Deep link to terminal |
| `{timestamp}` | Time of alert |

### Style Types
- `main_alert` — standard alert for Main channel
- `premium_alert` — enhanced alert for Premium (more data)
- `early_alert` — minimal, speed-first for Early CA tier
- `10x_forward` — used when a token hits 10x after alert

### UI
- Textarea with variable autocomplete
- Live Telegram-style preview panel
- Char count, emoji support
- Save as draft, publish, rollback to previous

---

## 3. Channel Manager

Control where signals go.

### Channel Schema
```
name:           string          "Main Channel"
platform:       enum            telegram | discord
channel_id:     string          Telegram/Discord ID
tier:           enum            free | premium | early
filter_id:      FK              which filter profile to apply
active:         boolean
delay_seconds:  number          premium = 0, free = 30
notify_on_10x:  boolean
```

### UI
- Channel cards with platform icon
- Drag-and-drop filter assignment
- Test button: send a dummy alert to the channel
- Delay slider (0–120 seconds) for tier differentiation

---

## 4. Content Library (Twitter / Social)

All templates are editable without code change.

### Template Categories
- `relatable` — trading struggle posts
- `rage_bait` — opinionated takes
- `ai_roast` — AI vs humans
- `educational` — tips
- `trending` — coin list posts
- `cta` — call to action (link to terminal)

### Template Schema
```
category:       enum
content:        string (up to 280 chars)
active:         boolean
weight:         number (higher = more likely to be picked)
min_interval_h: number (cooldown before reuse)
```

### Influencer Tags
```
handle:         string      "@kol_handle"
cooldown_days:  number      7
max_per_week:   number      1
active:         boolean
```

### Topic Cooldowns
```
topic_key:      string      "pumpfun_rugs"
label:          string      "Pump.fun Rug Criticism"
cooldown_days:  number      3
max_per_period: number      2
active:         boolean
```

### UI
- Template list per category with enable/disable
- Weight slider (controls posting frequency)
- Cooldown input per template
- Influencer tag table with add/remove
- Topic cooldown table

---

## 5. Pricing Manager

Control all monetization without touching code.

### Subscription Tiers
```
name:           string          "Premium"
price_usd:      number          49.00
price_sol:      number          auto-calculated at checkout
duration_days:  number          30
features:       array           ["early_alerts", "scanner_scores", "priority"]
active:         boolean
```

### Discount Codes
```
code:           string          "ALPHA50"
type:           enum            percent | flat_usd
value:          number          50 (= 50% or $50)
max_uses:       number          100
uses_so_far:    number          (read-only)
expires_at:     date
active:         boolean
```

### Referral Rates
```
tier:           string          "standard"
commission_pct: number          20
payout_currency:enum            SOL | SOUL_TOKEN
min_payout_usd: number          10
```

---

## 6. Performance Dashboard

Everything tracked. Nothing hidden.

### Alert Log
| Column | Description |
|---|---|
| Time | When alert was sent |
| Token | Name + CA |
| Channel | Which channel |
| Filter | Which filter passed it |
| Score | Scanner score at time |
| MCap | Market cap at alert |
| 1h Result | % change at 1h |
| 4h Result | % change at 4h |
| 24h Result | % change at 24h |
| Outcome | 2x / 5x / Rug / Flat |

### Win Rate Summary
- Overall win rate (last 7d / 30d / 90d / all time)
- Per-filter win rate (shows which filter is performing)
- Per-channel win rate
- Win rate by time of day (heatmap)
- **Public badge**: embeddable widget showing live win rate

### Revenue Metrics
- Total trading fees (7d / 30d / all time)
- Total subscription revenue
- Total referral payouts
- Active subscribers count
- MRR estimate
- Churn rate

### User Metrics
- New subscribers today / this week
- Active users (last 7d)
- Top referrers
- Geographic breakdown (Telegram user locations)
