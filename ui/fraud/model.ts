// Fraud and risk scoring: an explainable points score, three decision bands, and what each choice of
// thresholds costs over a sample of payments. Real systems use machine-learned scores; additive points keep
// the idea visible. All rates are illustrative.

export type Decision = "approve" | "challenge" | "decline";
export type Thresholds = { challenge: number; decline: number }; // score ≥ challenge → 3-D Secure, ≥ decline → decline

export type Signal = {
  id: string;
  label: string;
  note: string;
  points: number;
  legit: number;
  fraud: number; // how often the signal shows up on genuine and on fraudulent payments
};

export const BASE = 5;

// Points roughly follow how much likelier a signal is on fraud than on genuine payments (fraud ÷ legit).
// They add up to 95, so the score never needs capping: BASE + every signal = 100.
export const SIGNALS: Signal[] = [
  {
    id: "velocity",
    label: "4+ attempts with this card in the last hour",
    note: "Typical of card testing: stolen numbers tried quickly with small amounts.",
    points: 20,
    legit: 0.01,
    fraud: 0.35,
  },
  {
    id: "country",
    label: "Card issued in a different country than the IP",
    note: "Genuine travellers do this too, so it weighs less on its own than combined.",
    points: 15,
    legit: 0.04,
    fraud: 0.5,
  },
  {
    id: "amount",
    label: "Amount 3× the customer's usual",
    note: "Fraudsters maximise what they get before the card is blocked.",
    points: 14,
    legit: 0.05,
    fraud: 0.45,
  },
  {
    id: "avs",
    label: "Billing address doesn't match the card (AVS)",
    note: "The issuer's address check failed: the buyer may not know the real cardholder's address.",
    points: 12,
    legit: 0.05,
    fraud: 0.4,
  },
  {
    id: "email",
    label: "Email address created this week",
    note: "Throwaway accounts are cheap; long-lived ones are not.",
    points: 12,
    legit: 0.03,
    fraud: 0.3,
  },
  {
    id: "ship",
    label: "Shipping address differs from billing",
    note: "Common for gifts, so a weak signal alone.",
    points: 8,
    legit: 0.15,
    fraud: 0.55,
  },
  {
    id: "device",
    label: "First time this device is seen",
    note: "Every new customer has a new device, so it barely counts on its own.",
    points: 7,
    legit: 0.25,
    fraud: 0.8,
  },
  {
    id: "proxy",
    label: "IP is a known proxy or VPN",
    note: "Hides where the buyer really is.",
    points: 7,
    legit: 0.03,
    fraud: 0.25,
  },
];

export const PRESETS: [string, string[]][] = [
  ["Regular customer", []],
  ["Traveller", ["country", "device"]],
  ["Gift order", ["ship", "amount"]],
  ["Card testing", ["velocity", "device", "proxy"]],
  ["Stolen card", ["country", "amount", "avs", "email", "ship", "device"]],
];

export function score(on: string[]) {
  const parts = SIGNALS.filter(s => on.includes(s.id)).map(s => ({ id: s.id, label: s.label, points: s.points }));
  return { score: BASE + parts.reduce((a, p) => a + p.points, 0), parts };
}

export const decide = (s: number, t: Thresholds): Decision =>
  s >= t.decline ? "decline" : s >= t.challenge ? "challenge" : "approve";

export const DECISION_INFO: Record<Decision, [string, string, string]> = {
  approve: [
    "--ok",
    "Approved",
    "Goes straight to the issuer with no friction. If it turns out to be fraud, the chargeback is the merchant's: without 3-D Secure there is no liability shift.",
  ],
  challenge: [
    "--hold",
    "Challenge with 3-D Secure",
    "The cardholder must confirm in their bank's app. Most fraudsters can't; some genuine customers give up. If it passes, fraud liability moves to the issuer.",
  ],
  decline: [
    "--bad",
    "Declined",
    "Stopped before it reaches the issuer. No fraud risk, but if the buyer was genuine the sale is lost, and often the customer too.",
  ],
};

// Economics of the sample. A lost genuine sale costs the profit on it; a fraud chargeback costs the whole amount
// (the goods are gone and the money goes back) plus the dispute fee.
export const SAMPLE = { size: 2000, fraudRate: 0.025, seed: 7 };
export const MARGIN = 0.3;
export const CHARGEBACK_FEE = 15;
export const CHALLENGE = { stopsFraud: 0.85, genuineAbandon: 0.1 };

export type Payment = { id: number; fraud: boolean; amount: number; signals: string[]; score: number };

// Small seeded PRNG (mulberry32), so the sample and its numbers are the same on every load.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Payments whose signals are drawn from the same rates the points are based on, then scored by `score`. */
export function sample({ size, fraudRate, seed } = SAMPLE): Payment[] {
  const r = rng(seed);
  return Array.from({ length: size }, (_, id) => {
    const fraud = r() < fraudRate;
    const signals = SIGNALS.filter(s => r() < (fraud ? s.fraud : s.legit)).map(s => s.id);
    const amount = Math.round((fraud ? 60 + r() * 340 : 15 + r() * 185) * 100) / 100;
    return { id, fraud, amount, signals, score: score(signals).score };
  });
}

export type Outcome = {
  genuine: Record<Decision, number>;
  fraud: Record<Decision, number>; // counts per band
  approvalRate: number; // genuine payments that end as sales (approved, or challenged and completed)
  fraudStopped: number; // fraud declined or failing the challenge
  fraudLoss: number; // chargebacks the merchant pays: approved fraud only (challenged fraud is the issuer's)
  lostProfit: number; // profit on genuine sales declined or abandoned in the challenge
  cost: number;
};

/** Expected outcome of a threshold setting over a sample (challenge results are averages, not draws). */
export function outcome(payments: Payment[], t: Thresholds): Outcome {
  const genuine = { approve: 0, challenge: 0, decline: 0 },
    fraud = { approve: 0, challenge: 0, decline: 0 };
  let fraudLoss = 0,
    lostProfit = 0,
    completed = 0,
    stopped = 0;
  for (const p of payments) {
    const d = decide(p.score, t);
    (p.fraud ? fraud : genuine)[d]++;
    if (p.fraud) {
      if (d === "approve") fraudLoss += p.amount + CHARGEBACK_FEE;
      stopped += d === "decline" ? 1 : d === "challenge" ? CHALLENGE.stopsFraud : 0;
    } else {
      const lost = d === "decline" ? 1 : d === "challenge" ? CHALLENGE.genuineAbandon : 0;
      lostProfit += lost * p.amount * MARGIN;
      completed += 1 - lost;
    }
  }
  const nGenuine = payments.filter(p => !p.fraud).length,
    nFraud = payments.length - nGenuine;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    genuine,
    fraud,
    approvalRate: nGenuine ? completed / nGenuine : 1,
    fraudStopped: nFraud ? stopped / nFraud : 1,
    fraudLoss: r2(fraudLoss),
    lostProfit: r2(lostProfit),
    cost: r2(fraudLoss + lostProfit),
  };
}

export const STEP = 5;
export const NEVER = 105; // a threshold above the maximum score switches that band off

/** The cheapest thresholds on a 5-point grid (challenge ≤ decline; either may be "never"). */
export function cheapest(payments: Payment[]): Thresholds & { cost: number } {
  let best = { challenge: NEVER, decline: NEVER, cost: Infinity };
  for (let c = 0; c <= NEVER; c += STEP)
    for (let d = c; d <= NEVER; d += STEP) {
      const { cost } = outcome(payments, { challenge: c, decline: d });
      if (cost < best.cost) best = { challenge: c, decline: d, cost };
    }
  return best;
}
