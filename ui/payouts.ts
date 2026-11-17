// Payout simulation: how settled card money becomes a bank deposit.
// Pure functions only, so payouts.check.ts can run it under plain Node.

export type Settings = {
  delay: number;          // business days from charge until funds are available (T+N)
  schedule: "daily" | "weekly";
  reservePct: number;     // rolling reserve withheld from each charge
  reserveDays: number;    // calendar days the reserve is held
};

export type EntryType = "charge" | "refund" | "chargeback" | "reserve_hold" | "reserve_release";
export type Entry = {
  id: number; day: number; type: EntryType; label: string;
  gross: number; fee: number; net: number;
  availableOn: number;    // day the net amount becomes available for payout
  payoutId?: number;
};
export type Payout = { id: number; created: number; arrival: number; amount: number; entryIds: number[] };
export type Balances = { pending: number; reserve: number; available: number; inTransit: number; inBank: number };
export type PayoutStatus = "PENDING" | "IN_TRANSIT" | "PAID";

export const DAYS = 14;
const START = new Date(Date.UTC(2026, 10, 2)); // Monday 2 Nov 2026
export const dayLabel = (d: number) =>
  new Date(START.getTime() + d * 864e5).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const isBusinessDay = (d: number) => d % 7 < 5;
export const addBusinessDays = (d: number, n: number) => {
  let x = d;
  for (let left = n; left > 0; ) { x++; if (isBusinessDay(x)) left--; }
  return x;
};

// Illustrative pricing: 2.9% + $0.30 per charge, $15 per chargeback, refunds don't return the fee.
const CARD_PCT = 0.029, CARD_FIXED = 0.3, DISPUTE_FEE = 15;
const r2 = (v: number) => Math.round(v * 100) / 100;

export const ACTIVITY: [day: number, type: "charge" | "refund" | "chargeback", amount: number, label: string][] = [
  [0, "charge", 120, "Order #1001"], [0, "charge", 80, "Order #1002"],
  [1, "charge", 250, "Order #1003"],
  [2, "charge", 60, "Order #1004"], [2, "refund", 40, "Refund of #1002 (partial)"],
  [3, "charge", 310, "Order #1005"],
  [4, "charge", 95, "Order #1006"],
  [5, "charge", 140, "Order #1007 (Saturday)"],
  [6, "charge", 75, "Order #1008 (Sunday)"],
  [7, "charge", 200, "Order #1009"], [7, "chargeback", 120, "Dispute on #1001"],
  [8, "charge", 180, "Order #1010"],
  [9, "charge", 90, "Order #1011"],
  [10, "charge", 400, "Order #1012"],
  [11, "charge", 130, "Order #1013"], [11, "refund", 60, "Refund of #1004"],
  [12, "charge", 50, "Order #1014"],
];

export function simulate(s: Settings) {
  const entries: Entry[] = [];
  const add = (e: Omit<Entry, "id">) => entries.push({ id: entries.length, ...e });

  for (const [day, type, amount, label] of ACTIVITY) {
    if (type === "charge") {
      const fee = r2(amount * CARD_PCT + CARD_FIXED), net = r2(amount - fee);
      const availableOn = addBusinessDays(day, s.delay);
      add({ day, type, label, gross: amount, fee, net, availableOn });
      const held = r2(net * s.reservePct);
      if (held > 0) {
        add({ day, type: "reserve_hold", label: `Reserve on ${label}`, gross: 0, fee: 0, net: -held, availableOn });
        add({ day, type: "reserve_release", label: `Reserve release for ${label}`, gross: 0, fee: 0, net: held, availableOn: Math.max(day + s.reserveDays, availableOn) });
      }
    } else {
      // Refunds and disputes come straight out of the available balance.
      const fee = type === "chargeback" ? DISPUTE_FEE : 0;
      add({ day, type, label, gross: -amount, fee, net: -r2(amount + fee), availableOn: day });
    }
  }

  // At the end of each payout day, everything available and not yet paid out goes in one payout.
  const payouts: Payout[] = [];
  for (let d = 0; d < DAYS; d++) {
    const payoutDay = s.schedule === "daily" ? isBusinessDay(d) : d % 7 === 4;
    if (!payoutDay) continue;
    const ready = entries.filter(e => e.availableOn <= d && e.payoutId === undefined && e.day <= d);
    const amount = r2(ready.reduce((a, e) => a + e.net, 0));
    if (amount <= 0) continue; // a negative balance waits for future sales
    const p: Payout = { id: payouts.length + 1, created: d, arrival: addBusinessDays(d, 1), amount, entryIds: ready.map(e => e.id) };
    ready.forEach(e => (e.payoutId = p.id));
    payouts.push(p);
  }
  return { entries, payouts };
}

/** Where every dollar of net activity sits at the end of day d. */
export function balancesOn(d: number, entries: Entry[], payouts: Payout[]): Balances {
  const b: Balances = { pending: 0, reserve: 0, available: 0, inTransit: 0, inBank: 0 };
  const paidBy = new Map(payouts.map(p => [p.id, p]));
  for (const e of entries) {
    if (e.day > d) continue;
    const p = e.payoutId !== undefined ? paidBy.get(e.payoutId) : undefined;
    if (p && p.created <= d) { if (p.arrival <= d) b.inBank += e.net; else b.inTransit += e.net; }
    else if (e.availableOn <= d) b.available += e.net;
    else if (e.type === "reserve_release") b.reserve += e.net;
    else b.pending += e.net;
  }
  for (const k of Object.keys(b) as (keyof Balances)[]) b[k] = r2(b[k]);
  return b;
}

export const payoutStatus = (p: Payout, d: number): PayoutStatus | null =>
  d < p.created ? null : d >= p.arrival ? "PAID" : d === p.created ? "PENDING" : "IN_TRANSIT";

export const netOf = (entries: Entry[], d: number) => r2(entries.filter(e => e.day <= d).reduce((a, e) => a + e.net, 0));
