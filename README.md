# ABBI DeskLive

Smart DCA Trading Bot for Indodax (SPOT ONLY)

## Architecture
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
plain

## Quick Start

```bash
npm install
cd backend && npm install
cd backend && node server.js
npm run dev
Bot Logic
Entry Criteria
Table
ConditionValue
Score>= threshold (bull:65, sideways:55, bear:40)
RSI< 50 (moderate oversold)
STRONG_BUYScore >= 85 AND RSI < 30
REDUCERSI >= 70
STRONG_SELLRSI >= 80
Score Composition (100 max)
Table
ComponentWeightCriteria
Trend40%Price vs MA20/50/200, MA rising
Valuation30%RSI < 30/40/50, BB lower touch
Support30%Distance from 20-period low
Regime Detection (1D Timeframe)
Table
Data SourcePeriodUsage
daily-history.json200+ daysMA20/50/200 for trend
price-history.jsonIntradayFallback if daily insufficient
Progressive Confidence:
< 20 days: sideways (default)
20-49 days: MA20 only
50-199 days: MA20 + MA50
200+ days: Full MA20/50/200
Risk Management
Table
RuleValue
Max positions10
Daily budgetRp 900.000
Min tradeRp 50.000
Max loss per position25% (blacklist)
Environment Variables
plain
INDODAX_API_KEY=your_key
INDODAX_SECRET_KEY=your_secret
API Endpoints
Table
EndpointDescription
GET /api/screeningGet all coin signals (score, RSI, recommendation)
GET /api/indodax/ticker_allProxy to Indodax ticker
POST /api/private/tradeExecute trade (legacy)
Data Flow
plain
Indodax API → price-history.json (15 min tick)
                    ↓
              daily-history.json (1 per day)
                    ↓
              Regime Detection (1D MA)
                    ↓
              Entry Decision (Score + RSI)
                    ↓
              Trade Execution
License
Private
