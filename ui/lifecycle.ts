import type { CSSProperties } from "react";

export type LifecycleStatus =
  | "PENDING" | "AUTHORIZED" | "DECLINED"
  | "CAPTURED" | "VOIDED" | "EXPIRED" | "FAILED"
  | "SETTLED" | "REFUNDED" | "CHARGEBACK";

export type Ledger = { avail: number; held: number; merchant: number; fees: number };
export type Hop = { route: string; text: string };
export type Action = { label: string; to: LifecycleStatus; hops: Hop[]; apply: (l: Ledger) => Ledger };

export const ACTORS = [
  ["customer", "Customer", "cardholder"],
  ["merchant", "Merchant", "POS / site"],
  ["processor", "Processor", "Stripe, Adyen"],
  ["acquirer", "Acquiring bank", "merchant's bank"],
  ["network", "Card network", "Visa, Mastercard"],
  ["issuer", "Issuing bank", "customer's bank"],
] as const;

export const PHASES: [string, LifecycleStatus[]][] = [
  ["1 · Authorization", ["PENDING", "AUTHORIZED", "DECLINED"]],
  ["2 · Capture", ["CAPTURED", "VOIDED", "EXPIRED", "FAILED"]],
  ["3 · Settlement", ["SETTLED"]],
  ["4 · Post-settlement", ["REFUNDED", "CHARGEBACK"]],
];

type Tone = "ok" | "hold" | "bad" | "idle" | "acc";
const TONES: Record<Tone, [string, string]> = {
  ok: ["--ok", "--ok-soft"], hold: ["--hold", "--hold-soft"], bad: ["--bad", "--bad-soft"],
  idle: ["--idle", "--idle-soft"], acc: ["--accent", "--accent-soft"],
};

export const STATES: Record<LifecycleStatus, [Tone, string]> = {
  PENDING: ["acc", "Card swiped, dipped or entered online. The request is on its way to the issuing bank and nothing is decided yet."],
  AUTHORIZED: ["hold", "The issuer approved and placed a hold. The money stays in the customer's account but can't be spent."],
  DECLINED: ["bad", "The issuer rejected it: insufficient funds, wrong card details or fraud detection. No funds are held."],
  CAPTURED: ["ok", "The merchant asked to collect the authorized funds and the sale joined today's batch. The customer still only sees a hold: the charge is posted when the batch is cleared."],
  VOIDED: ["idle", "Cancelled before capture by the merchant or processor. No funds move and the hold is released."],
  EXPIRED: ["idle", "Not captured within the allowed window (typically 7 days). The authorization lapses and the hold is released."],
  FAILED: ["bad", "The capture attempt didn't go through: network issue, merchant processing error or bank rejection. The hold remains until it is retried or expires."],
  SETTLED: ["ok", "The batch was cleared (the issuer posted the charge to the cardholder) and settled (money moved from issuer to acquirer, minus fees). The merchant is paid out next."],
  REFUNDED: ["acc", "The merchant voluntarily returned the money to the customer. Processing fees are usually not given back."],
  CHARGEBACK: ["bad", "The customer disputed with their issuer, which pulls the funds back from the merchant until the dispute is resolved. The merchant also pays a fee."],
};

/** Inline style that feeds a status's colour into the `--c` / `--cs` tokens used by .badge and .state. */
export const tone = (s: string): CSSProperties => {
  const [c, cs] = TONES[STATES[s as LifecycleStatus]?.[0] ?? "idle"];
  return { "--c": `var(${c})`, "--cs": `var(${cs})` } as CSSProperties;
};

export const money = (v: number) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);

// Illustrative fees: interchange 1.5%, scheme 0.15%, processor 0.5% + $0.10.
const T = 210;
const round = (v: number) => +v.toFixed(2);
const TOTAL_FEES = round(T * 0.015 + T * 0.0015 + T * 0.005 + 0.1);
const CHARGEBACK_FEE = 15;

export const START: Ledger = { avail: 1000, held: 0, merchant: 0, fees: 0 };

export const LEDGER_ROWS: [keyof Ledger, string, string][] = [
  ["avail", "Customer available", "spendable balance"],
  ["held", "Customer on hold", "authorized; becomes a posted charge at clearing"],
  ["merchant", "Merchant account", "net after fees"],
  ["fees", "Fees taken", "issuer, network, processor"],
];

const h = (route: string, text: string): Hop => ({ route, text });
const release = (l: Ledger): Ledger => ({ ...l, avail: l.avail + l.held, held: 0 });

/** Actions available from each status; "START" is before the card is used. */
export const ACTIONS: Record<LifecycleStatus | "START", Action[]> = {
  START: [{ label: "Pay with card", to: "PENDING", apply: l => l, hops: [
    h("customer→merchant", "Card swiped, dipped or typed in for $210 (order $200 + tip $10)."),
    h("merchant→processor", "Merchant sends encrypted card data and amount to the processor."),
  ] }],
  PENDING: [
    { label: "Issuer approves", to: "AUTHORIZED", apply: l => ({ ...l, avail: l.avail - T, held: T }), hops: [
      h("processor→network", "Processor routes the authorization request to the card network."),
      h("network→issuer", "Network forwards it to the customer's issuing bank."),
      h("issuer→network", "Issuer checks funds and fraud rules, approves and places a $210 hold."),
      h("network→merchant", "Approval code travels back through network and processor to the merchant."),
    ] },
    { label: "Issuer declines", to: "DECLINED", apply: l => l, hops: [
      h("network→issuer", "Network forwards the request to the issuing bank."),
      h("issuer→merchant", "Issuer declines: insufficient funds, bad card details or suspected fraud."),
    ] },
  ],
  AUTHORIZED: [
    { label: "Merchant captures", to: "CAPTURED", apply: l => l, hops: [
      h("merchant→processor", "Merchant sends a capture request for the authorized amount."),
      h("processor→acquirer", "The sale is added to the merchant's open batch for today. Nothing is sent to the issuer yet."),
    ] },
    { label: "Merchant voids", to: "VOIDED", apply: release, hops: [
      h("merchant→processor", "Merchant cancels the sale before capture."),
      h("processor→issuer", "Void travels through the network; the issuer releases the hold."),
    ] },
    { label: "Wait 7 days", to: "EXPIRED", apply: release, hops: [
      h("issuer→customer", "No capture arrived in time. The issuer drops the authorization and releases the hold."),
    ] },
    { label: "Capture fails", to: "FAILED", apply: l => l, hops: [
      h("merchant→processor", "Merchant sends a capture request."),
      h("processor→acquirer", "The request errors out: network issue or bank rejection. The hold stays."),
    ] },
  ],
  FAILED: [
    { label: "Retry capture", to: "CAPTURED", apply: l => l, hops: [
      h("merchant→acquirer", "Merchant retries; the sale is added to today's open batch."),
    ] },
    { label: "Give up (expires)", to: "EXPIRED", apply: release, hops: [
      h("issuer→customer", "The authorization window closes and the hold is released."),
    ] },
  ],
  CAPTURED: [
    { label: "Close batch (clear + settle)", to: "SETTLED", apply: l => ({ ...l, held: 0, merchant: round(T - TOTAL_FEES), fees: TOTAL_FEES }), hops: [
      h("merchant→acquirer", "Cut-off: the merchant's batch closes and the acquirer sends clearing records to the network."),
      h("network→issuer", "Clearing: the issuer receives the record and posts the $210 charge to the cardholder. The hold is gone."),
      h("issuer→network", "Settlement: the issuer sends the funds minus interchange to the network."),
      h("network→acquirer", "Network takes its scheme fee and pays the acquiring bank."),
      h("acquirer→merchant", "Acquirer and processor take their cut and deposit the net amount."),
    ] },
  ],
  SETTLED: [
    { label: "Merchant refunds", to: "REFUNDED", apply: l => ({ ...l, avail: l.avail + T, merchant: round(l.merchant - T) }), hops: [
      h("merchant→processor", "Merchant issues a full refund through the processor."),
      h("acquirer→issuer", "Funds flow back through acquirer and network to the issuer."),
      h("issuer→customer", "Customer's available balance goes back up by $210."),
    ] },
    { label: "Customer disputes", to: "CHARGEBACK", apply: l => ({ ...l, avail: l.avail + T, merchant: round(l.merchant - T - CHARGEBACK_FEE), fees: round(l.fees + CHARGEBACK_FEE) }), hops: [
      h("customer→issuer", "Customer files a dispute with their bank."),
      h("issuer→network", "Issuer reverses the funds through the network."),
      h("acquirer→merchant", "Acquirer debits the merchant $210 plus a $15 chargeback fee."),
    ] },
  ],
  DECLINED: [], VOIDED: [], EXPIRED: [], REFUNDED: [], CHARGEBACK: [],
};
