// Double-entry bookkeeping for card payments: the same events posted in the merchant's and the processor's books.
// All amounts are integer cents so debits and credits balance exactly.

export type Book = "merchant" | "processor";
export type Kind = "asset" | "liability" | "revenue" | "expense";
export type Account = { id: string; name: string; kind: Kind; note: string };
export type Side = "dr" | "cr";
export type Line = { account: string; side: Side; cents: number };
export type EventKind = "sale" | "refund" | "chargeback" | "won" | "settle" | "payout";
export type Entry = {
  n: number;
  kind: EventKind;
  title: string;
  lines: Record<Book, Line[]>;
  why: Record<Book, string>;
};

export const SALE = 10_000;
export const REFUND = 3_000;
export const DISPUTE_FEE = 1_500;
export const FEE = 320; // merchant pays 2.9% + 30¢ on $100
export const COST = 190; // processor pays interchange + scheme fees, ~1.8% + 10¢

export const KINDS: [Kind, string, Side][] = [
  ["asset", "Assets", "dr"],
  ["liability", "Liabilities", "cr"],
  ["revenue", "Revenue", "cr"],
  ["expense", "Expenses", "dr"],
];
export const normal = (k: Kind): Side => KINDS.find(x => x[0] === k)![2];

export const ACCOUNTS: Record<Book, Account[]> = {
  merchant: [
    { id: "cash", name: "Cash at bank", kind: "asset", note: "Money in the merchant's own bank account." },
    {
      id: "recv",
      name: "Due from processor",
      kind: "asset",
      note: "Sales the processor holds and has not paid out yet.",
    },
    { id: "sales", name: "Sales", kind: "revenue", note: "Gross card sales." },
    {
      id: "refunds",
      name: "Refunds",
      kind: "expense",
      note: "Contra-revenue: reduces sales. Kept apart so gross sales stay visible.",
    },
    { id: "cbloss", name: "Chargeback losses", kind: "expense", note: "Sales taken back by the card network." },
    { id: "fees", name: "Processing fees", kind: "expense", note: "Per-sale fees and dispute fees." },
  ],
  processor: [
    { id: "cash", name: "Cash at bank", kind: "asset", note: "The processor's own bank account." },
    {
      id: "net",
      name: "Due from card network",
      kind: "asset",
      note: "What the network will settle, after interchange and scheme fees.",
    },
    {
      id: "payable",
      name: "Owed to merchant",
      kind: "liability",
      note: "The merchant's balance. It is the merchant's money, not the processor's.",
    },
    {
      id: "feerev",
      name: "Fee revenue",
      kind: "revenue",
      note: "Processing and dispute fees charged to the merchant.",
    },
    {
      id: "cost",
      name: "Interchange & scheme",
      kind: "expense",
      note: "Paid to the issuer and the network on every sale.",
    },
  ],
};

export const EVENTS: [EventKind, string][] = [
  ["sale", "Card sale $100"],
  ["refund", "Refund $30"],
  ["chargeback", "Chargeback $100"],
  ["won", "Win the dispute"],
  ["settle", "Network settles"],
  ["payout", "Payout"],
];

const dr = (account: string, cents: number): Line => ({ account, side: "dr", cents });
const cr = (account: string, cents: number): Line => ({ account, side: "cr", cents });
// A transfer whose direction depends on the sign of the amount (a negative payout is a debit from the merchant's bank).
const move = (to: string, from: string, cents: number) =>
  cents >= 0 ? [dr(to, cents), cr(from, cents)] : [dr(from, -cents), cr(to, -cents)];

export type Balances = Record<Book, Record<string, number>>;

export function balances(entries: Entry[]): Balances {
  const out = {} as Balances;
  for (const book of ["merchant", "processor"] as Book[]) {
    out[book] = Object.fromEntries(ACCOUNTS[book].map(a => [a.id, 0]));
    for (const e of entries)
      for (const l of e.lines[book]) {
        const a = ACCOUNTS[book].find(x => x.id === l.account)!;
        out[book][l.account] += l.side === normal(a.kind) ? l.cents : -l.cents;
      }
  }
  return out;
}

function entryFor(kind: EventKind, b: Balances): Omit<Entry, "n"> {
  switch (kind) {
    case "sale":
      return {
        kind,
        title: "Card sale $100",
        lines: {
          merchant: [dr("recv", SALE - FEE), dr("fees", FEE), cr("sales", SALE)],
          processor: [dr("net", SALE - COST), dr("cost", COST), cr("payable", SALE - FEE), cr("feerev", FEE)],
        },
        why: {
          merchant:
            "Revenue is the full $100 even though only $96.80 will arrive. The $3.20 fee is recorded as an expense, not netted away.",
          processor:
            "The processor will get $98.10 from the network (after interchange and scheme), owes the merchant $96.80 and keeps $3.20 as revenue. Its margin is $1.30.",
        },
      };
    case "refund":
      return {
        kind,
        title: "Refund $30",
        lines: {
          merchant: [dr("refunds", REFUND), cr("recv", REFUND)],
          processor: [dr("payable", REFUND), cr("net", REFUND)],
        },
        why: {
          merchant:
            "The refund lowers what the processor owes. The original sale and its fee stay on the books: on blended pricing the fee is not returned.",
          processor:
            "The processor sends $30 back through the network and takes it from the merchant's balance. No revenue changes.",
        },
      };
    case "chargeback":
      return {
        kind,
        title: "Chargeback $100",
        lines: {
          merchant: [dr("cbloss", SALE), dr("fees", DISPUTE_FEE), cr("recv", SALE + DISPUTE_FEE)],
          processor: [dr("payable", SALE + DISPUTE_FEE), cr("net", SALE), cr("feerev", DISPUTE_FEE)],
        },
        why: {
          merchant:
            "The network takes the $100 back and the processor charges $15 for handling the dispute. Both come out of the merchant's balance.",
          processor:
            "The network pulls $100 from the processor, which recovers it from the merchant's balance, plus a $15 fee it books as revenue.",
        },
      };
    case "won":
      return {
        kind,
        title: "Dispute won",
        lines: { merchant: [dr("recv", SALE), cr("cbloss", SALE)], processor: [dr("net", SALE), cr("payable", SALE)] },
        why: {
          merchant:
            "Representment succeeded: the loss is reversed and the $100 is owed again. The $15 dispute fee is not refunded.",
          processor: "The network returns the $100 and the processor owes it to the merchant again.",
        },
      };
    case "settle":
      return {
        kind,
        title: "Network settles",
        lines: { merchant: [], processor: move("cash", "net", b.processor.net) },
        why: {
          merchant:
            "Nothing to record: settlement between the network and the processor does not change what the merchant is owed.",
          processor:
            "One net transfer arrives from the network (or goes to it, if refunds and chargebacks exceed sales). An asset changes form: receivable becomes cash.",
        },
      };
    case "payout":
      return {
        kind,
        title: b.merchant.recv >= 0 ? "Payout to merchant" : "Debit merchant's bank",
        lines: {
          merchant: move("cash", "recv", b.merchant.recv),
          processor: move("payable", "cash", b.processor.payable),
        },
        why: {
          merchant:
            b.merchant.recv >= 0
              ? "The balance moves into the bank account. Income was already recorded at the sale, so a payout is not revenue."
              : "The balance is negative, so the processor pulls the difference from the merchant's bank.",
          processor:
            b.processor.payable >= 0
              ? "Paying out reduces the liability and the cash together. If the network hasn't settled yet, the processor's cash goes negative: it is fronting the money."
              : "The merchant owed the processor; collecting it brings cash in and clears the negative balance.",
        },
      };
  }
}

// Replay a list of events into journal entries, in order.
export function post(events: EventKind[]): Entry[] {
  const entries: Entry[] = [];
  for (const k of events) entries.push({ n: entries.length + 1, ...entryFor(k, balances(entries)) });
  return entries;
}

// Which events make sense now, with the reason when they don't.
export function available(events: EventKind[]): Record<EventKind, string | null> {
  const count = (k: EventKind) => events.filter(e => e === k).length;
  const open = count("sale") - count("refund") - count("chargeback");
  const b = balances(post(events));
  return {
    sale: null,
    refund: open > 0 ? null : "No sale left to refund",
    chargeback: open > 0 ? null : "No sale left to dispute",
    won: count("chargeback") > count("won") ? null : "No open chargeback",
    settle: b.processor.net ? null : "Nothing to settle",
    payout: b.merchant.recv ? null : "Balance is zero",
  };
}

export const total = (lines: Line[], side: Side) => lines.filter(l => l.side === side).reduce((a, l) => a + l.cents, 0);

// Assets = liabilities + equity, where equity here is revenue − expenses.
export function equation(book: Book, b: Balances) {
  const sum = (k: Kind) => ACCOUNTS[book].filter(a => a.kind === k).reduce((s, a) => s + b[book][a.id], 0);
  return { assets: sum("asset"), liabilities: sum("liability"), equity: sum("revenue") - sum("expense") };
}
