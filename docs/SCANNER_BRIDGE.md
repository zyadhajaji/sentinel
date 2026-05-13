# Scanner Bridge — How Your Scanner Feeds the Terminal

The scanner bridge is the layer that connects your existing scanner bot
to every part of the new product. It replaces Telethon entirely.

---

## How It Works

```
YOUR SCANNER BOT
  (existing Python bot, unchanged)
        │
        │ HTTP POST to /api/scanner/ingest
        │ (local or authenticated endpoint)
        ▼
  SCANNER BRIDGE (ingest.py)
        │
        ├── Validate signal (schema check)
        ├── Deduplicate (Redis: seen in last 10 min?)
        ├── Enrich (fetch DexScreener + Helius data)
        ├── Score (your scanner's score passed through or recalculated)
        │
        ▼
  FILTER ENGINE (filters.py)
        │
        ├── Load active filters from DB
        ├── Apply each filter's conditions
        ├── Determine which channels this signal qualifies for
        │
        ▼
  PIPELINE (pipeline.py)
        │
        ├── Publish to Redis pub/sub channels
        ├── Log to PostgreSQL (alert_log table)
        ├── Trigger win-rate tracking job (check price at T+1h, T+4h, T+24h)
        │
        ▼
  SUBSCRIBERS
  ├── Telegram Bot (reads Redis, sends to channels)
  ├── Discord Bot (reads Redis, sends to channels)
  └── Web Terminal (reads Redis via WebSocket/SSE, updates live feed)
```

---

## Signal Schema (What Your Scanner Sends)

```json
{
  "ca": "So1anaContractAddressHere...",
  "token_name": "BONK",
  "token_symbol": "BONK",
  "scanner_score": 87,
  "chain": "solana",
  "source": "pumpfun",
  "liquidity_usd": 125000,
  "mcap_usd": 450000,
  "holders": 342,
  "top_holder_pct": 8.2,
  "mint_authority_revoked": true,
  "freeze_authority_revoked": true,
  "contract_age_minutes": 47,
  "has_twitter": true,
  "has_website": false,
  "price_usd": 0.000042,
  "timestamp": "2026-05-13T14:30:00Z",
  "raw_data": {}
}
```

---

## Integration Options

### Option A: Direct HTTP (simplest)
Your scanner bot POSTs to the bridge endpoint every time it finds a token.
```python
import httpx
httpx.post("http://localhost:8080/api/scanner/ingest", json=signal_data)
```

### Option B: Redis Queue (if scanner and bridge are on same server)
Your scanner bot pushes to a Redis list.
Bridge worker pops from the list.
```python
redis_client.lpush("scanner:queue", json.dumps(signal_data))
```

### Option C: Webhook (if scanner is remote)
Same as Option A but with HMAC signature verification for security.
```
POST /api/scanner/ingest
Headers: X-Scanner-Signature: hmac_sha256(secret, body)
```

---

## Deduplication

Redis SET with TTL.
```
key: "signal:dedup:{ca}"
value: 1
ttl: 600 seconds (10 minutes)
```
If CA was seen in the last 10 minutes, signal is dropped.

---

## Enrichment (What the Bridge Adds)

Even if your scanner sends minimal data, the bridge fills in gaps:

| Field | Source | If unavailable |
|---|---|---|
| Price chart data | DexScreener | Skip |
| Holder details | Helius DAS | Skip, log warning |
| Token metadata | DexScreener | Required |
| Social links | DexScreener | Optional |

Enrichment is async and non-blocking. Signal goes to filter engine immediately,
enrichment data is added before the formatted alert is sent.

---

## Filter Engine

Loads the active filter profiles from PostgreSQL on startup.
Refreshes every 60 seconds (so admin changes take effect within a minute).

For each signal:
1. Run against every active filter
2. Collect list of filters it passed
3. Look up which channels each filter is assigned to
4. Build routing map: {channel_id: filter_that_passed}

Example output:
```python
routing = {
    "-100123456789": "safe_launch",    # Main channel
    "-100987654321": "snipe_grade",    # Premium channel
    "123456789":     "early_access"    # Early CA user
}
```

---

## Win-Rate Tracking Job

After every alert is logged, a background job is scheduled:
```
T + 1 hour:  fetch price from DexScreener, calculate % change, save
T + 4 hours: fetch price, calculate % change, save
T + 24 hours: fetch price, calculate % change, classify outcome
```

Outcome classification:
- **5x+**: moonshot
- **2x–5x**: win
- **0–2x**: flat
- **Negative > 50%**: rug
- **Token gone**: confirmed rug

This data feeds the admin dashboard and the public win-rate page.
