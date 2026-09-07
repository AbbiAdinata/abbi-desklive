# ABBI DeskLive

Smart DCA Trading Bot for Indodax (SPOT ONLY)

## Architecture

```
abbi-desklive/
├── backend/                    # Node.js API + Bot Engine
│   ├── server.js               # Entry point + API routes
│   ├── engine/
│   │   ├── AutoScanner.js      # DCA bot logic + regime detection
│   │   └── CoinGeckoAPI.js     # Price cache (Indodax only)
│   ├── cache/
│   │   ├── price-history.json  # Intraday tick data (15 min)
│   │   ├── daily-history.json  # Daily close data (1 per day)
│   │   └── scanner-state.json  # Bot state (positions, budget)
│   └── IndodaxClient.js        # Exchange API
├── src/                        # React Frontend
│   ├── components/             # UI components
│   └── core/                   # Types, constants, API client
└── package.json
```

## Quick Start

```bash
npm install
cd backend && npm install
cd backend && node server.js
npm run dev
```

## Bot Logic

### Entry Criteria

| Condition | Value |
|-----------|-------|
| Score | &gt;= threshold (bull:65, sideways:55, bear:40) |
| RSI | &lt; 50 (moderate oversold) |
| STRONG_BUY | Score &gt;= 85 AND RSI &lt; 30 |
| REDUCE | RSI &gt;= 70 |
| STRONG_SELL | RSI &gt;= 80 |

### Score Composition (100 max)

| Component | Weight | Criteria |
|-----------|--------|----------|
| Trend | 40% | Price vs MA20/50/200, MA rising |
| Valuation | 30% | RSI &lt; 30/40/50, BB lower touch |
| Support | 30% | Distance from 20-period low |

### Regime Detection (1D Timeframe)

| Data Source | Period | Usage |
|-------------|--------|-------|
| daily-history.json | 200+ days | MA20/50/200 for trend |
| price-history.json | Intraday | Fallback if daily insufficient |

**Progressive Confidence:**
- &lt; 20 days: sideways (default)
- 20-49 days: MA20 only
- 50-199 days: MA20 + MA50
- 200+ days: Full MA20/50/200

## Risk Management

| Rule | Value |
|------|-------|
| Max positions | 10 |
| Daily budget | Rp 900.000 |
| Min trade | Rp 50.000 |
| Max loss per position | 25% (blacklist) |

## Environment Variables

```
INDODAX_API_KEY=your_key
INDODAX_SECRET_KEY=your_secret
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/screening | Get all coin signals (score, RSI, recommendation) |
| GET /api/indodax/ticker_all | Proxy to Indodax ticker |
| POST /api/private/trade | Execute trade (legacy) |

## Data Flow

```
Indodax API → price-history.json (15 min tick)
                    ↓
              daily-history.json (1 per day)
                    ↓
              Regime Detection (1D MA)
                    ↓
              Entry Decision (Score + RSI)
                    ↓
              Trade Execution
```

## License

Private
