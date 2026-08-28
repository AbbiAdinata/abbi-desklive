# ABBI DeskLive

Smart DCA Trading Bot for Indodax (SPOT ONLY)

## Architecture

abbi-desklive/
├── backend/           # Node.js API + Bot Engine
│   ├── server.js      # Entry point
│   └── engine/
│       ├── AutoScanner.js      # DCA bot logic
│       ├── CoinGeckoAPI.js     # Price cache (Indodax only)
│       └── IndodaxClient.js    # Exchange API
├── src/               # React Frontend
├── public/            # Static assets
└── package.json

## Quick Start

npm install
cd backend && npm install
cd backend && node server.js
npm run dev

## Bot Logic

- Scan interval: Every 15 minutes
- Entry condition: Score >= threshold (bull:75, sideways:65, bear:50)
- Score composition: Trend(30) + Valuation(35) + Support(25) + Confluence(10) = 100
- Regime detection: Based on MA trend (real market data)
- Data source: Indodax real-time (CoinGecko disabled)

## Environment Variables

INDODAX_API_KEY=your_key
INDODAX_SECRET_KEY=your_secret

## License

Private
