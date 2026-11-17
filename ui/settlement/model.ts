// Clearing and settlement of one merchant's daily batch. Pure data and functions (see settlement.check.ts).
// Rates are illustrative, loosely US-shaped; real interchange tables have hundreds of categories.

export type Brand = "Visa" | "Mastercard";
export type CardType = "regulated debit" | "debit" | "credit" | "rewards credit" | "commercial";
export type Pricing = "icpp" | "blended";
export type Tx = {
  id: number;
  time: string;
  brand: Brand;
  card: CardType;
  issuer: string;
  amount: number;
  refund?: boolean;
};
export type Split = { interchange: number; scheme: number; processor: number; merchant: number };

const r2 = (v: number) => Math.round(v * 100) / 100;

export const INTERCHANGE: Record<CardType, [pct: number, fixed: number, note: string]> = {
  "regulated debit": [0.0005, 0.21, "Debit from a large bank; capped by law (Durbin)"],
  debit: [0.008, 0.15, "Debit from a small bank or credit union"],
  credit: [0.0165, 0.1, "Standard consumer credit card"],
  "rewards credit": [0.021, 0.1, "Premium card; the rewards are paid for by interchange"],
  commercial: [0.025, 0.1, "Business or corporate card"],
};
export const SCHEME_PCT: Record<Brand, number> = { Visa: 0.0014, Mastercard: 0.0013 };
export const MARKUP = { pct: 0.002, fixed: 0.1 }; // interchange++ processor markup
export const BLENDED = { pct: 0.029, fixed: 0.3 }; // one flat price for every card

export const BATCH: Tx[] = [
  { id: 1, time: "08:12", brand: "Visa", card: "regulated debit", issuer: "Summit Bank", amount: 4.5 },
  { id: 2, time: "09:40", brand: "Visa", card: "rewards credit", issuer: "Northwind Bank", amount: 86 },
  { id: 3, time: "11:05", brand: "Mastercard", card: "credit", issuer: "Northwind Bank", amount: 42.3 },
  { id: 4, time: "12:31", brand: "Visa", card: "debit", issuer: "Harbor Credit Union", amount: 18.75 },
  { id: 5, time: "13:58", brand: "Mastercard", card: "commercial", issuer: "Northwind Bank", amount: 640 },
  { id: 6, time: "15:20", brand: "Visa", card: "credit", issuer: "Northwind Bank", amount: 125 },
  { id: 7, time: "16:47", brand: "Visa", card: "debit", issuer: "Harbor Credit Union", amount: 27.9 },
  { id: 8, time: "17:15", brand: "Visa", card: "rewards credit", issuer: "Summit Bank", amount: 210 },
  { id: 9, time: "18:02", brand: "Visa", card: "credit", issuer: "Northwind Bank", amount: 60, refund: true },
];

export const interchangeOf = (t: Tx) => {
  const [pct, fixed] = INTERCHANGE[t.card];
  return r2(t.amount * pct + fixed);
};

/**
 * Where each dollar of a transaction goes. The four parts always add up to the signed amount
 * (negative for a refund). Refunds here: the issuer returns the interchange, no new fees are charged.
 */
export function split(t: Tx, pricing: Pricing): Split {
  const ic = interchangeOf(t);
  if (t.refund) {
    // IC++: the returned interchange is passed back to the merchant. Blended: the processor keeps it.
    return pricing === "icpp"
      ? { interchange: -ic, scheme: 0, processor: 0, merchant: r2(-t.amount + ic) }
      : { interchange: -ic, scheme: 0, processor: ic, merchant: -t.amount };
  }
  const scheme = r2(t.amount * SCHEME_PCT[t.brand]);
  if (pricing === "icpp") {
    const processor = r2(t.amount * MARKUP.pct + MARKUP.fixed);
    return { interchange: ic, scheme, processor, merchant: r2(t.amount - ic - scheme - processor) };
  }
  const merchant = r2(t.amount - (t.amount * BLENDED.pct + BLENDED.fixed));
  return { interchange: ic, scheme, processor: r2(t.amount - ic - scheme - merchant), merchant };
}

export const signed = (t: Tx) => (t.refund ? -t.amount : t.amount);

export type Positions = {
  issuers: { brand: Brand; issuer: string; count: number; gross: number; interchange: number; pays: number }[];
  networks: { brand: Brand; received: number; scheme: number; paysAcquirer: number }[];
  acquirerReceives: number;
};

/** Net settlement: each issuer makes one transfer per network, each network one transfer to the acquirer. */
export function positions(txs: Tx[]): Positions {
  const issuers = new Map<string, Positions["issuers"][number]>();
  for (const t of txs) {
    const key = `${t.brand}|${t.issuer}`;
    const row = issuers.get(key) ?? { brand: t.brand, issuer: t.issuer, count: 0, gross: 0, interchange: 0, pays: 0 };
    const ic = split(t, "icpp").interchange; // what the issuer keeps doesn't depend on merchant pricing
    row.count++;
    row.gross = r2(row.gross + signed(t));
    row.interchange = r2(row.interchange + ic);
    row.pays = r2(row.gross - row.interchange);
    issuers.set(key, row);
  }
  const brands = [...new Set(txs.map(t => t.brand))];
  const networks = brands.map(brand => {
    const received = r2([...issuers.values()].filter(i => i.brand === brand).reduce((a, i) => a + i.pays, 0));
    const scheme = r2(txs.filter(t => t.brand === brand).reduce((a, t) => a + split(t, "icpp").scheme, 0));
    return { brand, received, scheme, paysAcquirer: r2(received - scheme) };
  });
  return {
    issuers: [...issuers.values()],
    networks,
    acquirerReceives: r2(networks.reduce((a, n) => a + n.paysAcquirer, 0)),
  };
}

export function totals(txs: Tx[], pricing: Pricing) {
  const t: Split & { gross: number } = { gross: 0, interchange: 0, scheme: 0, processor: 0, merchant: 0 };
  for (const x of txs) {
    const s = split(x, pricing);
    t.gross += signed(x);
    t.interchange += s.interchange;
    t.scheme += s.scheme;
    t.processor += s.processor;
    t.merchant += s.merchant;
  }
  for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] = r2(t[k]);
  return t;
}

export const STAGES = [
  {
    name: "Open batch",
    when: "T+0, during the day",
    route: "customer→merchant",
    text: "Each sale is authorized and captured. Captured sales collect in the merchant's open batch. Cardholders only see holds.",
  },
  {
    name: "Batch close",
    when: "T+0, cut-off (e.g. 23:00)",
    route: "merchant→processor→acquirer",
    text: "The terminal or processor closes the batch. From here, its total is fixed. Later sales go into tomorrow's batch.",
  },
  {
    name: "Clearing",
    when: "T+0 night",
    route: "acquirer→network→issuer",
    text: "The acquirer sends one clearing record per sale to each card network, which routes them to the issuers. Issuers post the charges and drop the holds. Interchange is calculated here.",
  },
  {
    name: "Settlement",
    when: "T+1",
    route: "issuer→network→acquirer",
    text: "Networks net all positions. Each issuer makes one transfer per network, keeping its interchange. The network deducts scheme fees and pays the acquirer.",
  },
  {
    name: "Funding",
    when: "T+1 to T+2",
    route: "acquirer→merchant",
    text: "The acquirer or processor deposits money into the merchant's bank account: net of fees, or gross with fees billed monthly. This is the payout.",
  },
] as const;
