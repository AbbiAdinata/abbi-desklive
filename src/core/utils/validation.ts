// ============================================================
// ABBI DeskLive — Input Validation Utilities (SEC-008 FIXED)
// ============================================================

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(`Validation failed for '${field}': ${message}`);
    this.name = 'ValidationError';
  }
}

export function validateSymbol(symbol: unknown, validSymbols: string[]): string {
  if (typeof symbol !== 'string') {
    throw new ValidationError('symbol', 'Must be a string');
  }
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    throw new ValidationError('symbol', 'Cannot be empty');
  }
  if (!validSymbols.includes(trimmed)) {
    throw new ValidationError('symbol', `${trimmed} is not in the supported coin universe`);
  }
  return trimmed;
}

export function validateAmount(amount: unknown): number {
  if (typeof amount !== 'number') {
    throw new ValidationError('amount', 'Must be a number');
  }
  if (Number.isNaN(amount)) {
    throw new ValidationError('amount', 'Cannot be NaN');
  }
  if (!Number.isFinite(amount)) {
    throw new ValidationError('amount', 'Cannot be Infinity');
  }
  if (amount <= 0) {
    throw new ValidationError('amount', 'Must be greater than 0');
  }
  return amount;
}

export function validatePrice(price: unknown): number {
  if (typeof price !== 'number') {
    throw new ValidationError('price', 'Must be a number');
  }
  if (Number.isNaN(price)) {
    throw new ValidationError('price', 'Cannot be NaN');
  }
  if (!Number.isFinite(price)) {
    throw new ValidationError('price', 'Cannot be Infinity');
  }
  if (price <= 0) {
    throw new ValidationError('price', 'Must be greater than 0');
  }
  return price;
}

export function validateTradeAmount(
  amountIdr: number,
  options: {
    min?: number;
    max?: number;
    maxDaily?: number;
    dailyUsed?: number;
  } = {}
): number {
  const validated = validateAmount(amountIdr);

  if (options.min !== undefined && validated < options.min) {
    throw new ValidationError(
      'amount',
      `Minimum trade is Rp${options.min.toLocaleString('id-ID')}`
    );
  }
  if (options.max !== undefined && validated > options.max) {
    throw new ValidationError(
      'amount',
      `Maximum per trade is Rp${options.max.toLocaleString('id-ID')}`
    );
  }
  if (options.maxDaily !== undefined && options.dailyUsed !== undefined) {
    const remaining = options.maxDaily - options.dailyUsed;
    if (validated > remaining) {
      throw new ValidationError(
        'amount',
        `Exceeds daily limit. Remaining: Rp${remaining.toLocaleString('id-ID')}`
      );
    }
  }
  return validated;
}

export function validateQuantity(amount: number, price: number): number {
  const quantity = amount / price;
  if (Number.isNaN(quantity) || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError(
      'quantity',
      `Invalid quantity ${quantity} from amount=${amount} / price=${price}`
    );
  }
  return quantity;
}