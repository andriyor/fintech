export type Amount = {
  transaction: number;
  tip: number;
  order: number;
};

export type Status = 'AUTHORIZED' | 'CAPTURED' | 'PENDING' | 'REFUNDED' | 'VOIDED';

export type Source = 'POS' | 'ECOMMERCE' | 'ACH' | 'POS' | 'QR_CODE';

export type Transaction = {
  amounts: Amount;
  status: Status;
  source: Source;
};
