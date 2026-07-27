# 🚀 ABBI DeskLive — Setup Auto-Trade (Panduan Orang Awam)

## Langkah 1: Dapatkan API Key dari Indodax

1. Login ke [indodax.com](https://indodax.com)
2. Menu **Account** → **Trade API**
3. Klik **Tambah Trade API**
4. Isi:
   - **Label**: `ABBI-Bot` (bebas)
   - **Permission**: ✅ Centang **Trade** saja
   - **Jangan centang**: ❌ Deposit & Withdraw (bahaya!)
5. Klik **Kirim PIN SMS** → masukin PIN dari HP
6. Klik **Aktifkan Trade API**
7. **SIMPAN** API Key & Secret (cuma ditampilkan sekali!)

## Langkah 2: Setup File .env

1. Copy file `.env.example` jadi `.env`
2. Isi dengan API key-mu:

```
VITE_INDODAX_API_KEY=isi_api_key_mu_disini
VITE_INDODAX_API_SECRET=isi_api_secret_mu_disini
VITE_API_MODE=mock        ← awalnya mock dulu!
VITE_AUTO_TRADE=false     ← awalnya manual dulu!
```

## Langkah 3: Install & Jalankan

```bash
npm install
npm run dev
```

## Langkah 4: Test Mode (WAJIB!)

1. Pastikan `VITE_API_MODE=mock`
2. Pastikan `VITE_AUTO_TRADE=false`
3. Jalankan ABBI → cek notifikasi sinyal
4. Kalau sinyal akurat selama 1 minggu → lanjut Step 5

## Langkah 5: Semi-Auto Mode

1. Ubah `VITE_AUTO_TRADE=false` (tetap)
2. Di dashboard, klik tombol **"Execute Trade"** saat ada sinyal
3. Bot yang kirim order ke Indodax, bukan kamu buka HP

## Langkah 6: Full Auto-Trade (HATI-HATI!)

1. Ubah `VITE_API_MODE=live`
2. Ubah `VITE_AUTO_TRADE=true`
3. Set limit aman:
   ```
   VITE_MAX_DAILY_INVESTMENT=1000000   # Max Rp 1 juta/hari dulu
   VITE_MAX_PER_TRADE=200000           # Max Rp 200rb per trade
   ```
4. Monitor 24 jam pertama!
5. Kalau aman 1 minggu → naikin limit

## ⚠️ SAFETY CHECKLIST

- [ ] API Key cuma punya permission "Trade"
- [ ] Jangan pernah share API Secret ke siapapun
- [ ] Jangan commit `.env` ke GitHub
- [ ] Set daily limit (jangan all-in!)
- [ ] Punya saldo IDR cadangan di Indodax
- [ ] Monitor bot tiap hari minimal 5 menit

## 🆘 Kalau Ada Masalah

| Masalah | Solusi |
|---------|--------|
| "Invalid API Key" | Cek API key di `.env`, restart server |
| "Daily limit reached" | Tunggu besok atau naikin `VITE_MAX_DAILY_INVESTMENT` |
| "Coin not in whitelist" | Tambahin coin ke whitelist di `TradeExecutor.ts` |
| Bot beli terus | Matikan `VITE_AUTO_TRADE=false`, cek circuit breaker |

## 📞 Butuh Bantuan?

Kalau bingung, balik ke mode `mock` dulu dan tanya developer-mu! 🙌
