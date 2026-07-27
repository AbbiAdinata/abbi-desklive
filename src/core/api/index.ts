// ============================================================
// ABBI DeskLive — Core API (Export Frontend-Safe modules only)
// ============================================================
// PERUBAHAN: IndodaxAuth.ts dan TradeExecutor.ts DIHAPUS.
// Frontend hanya mengakses public API melalui BackendClient.
// Private API (HMAC signing) hanya ada di backend server.
// ============================================================

export { BackendClient, backendClient } from './BackendClient';
export type { TradeResult, BalanceResult } from './BackendClient';