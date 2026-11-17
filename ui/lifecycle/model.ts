import type { CSSProperties } from "react";
import type { Hop } from "../shared/parties.ts";
import { money } from "../shared/money.ts";

export type LifecycleStatus =
  | "PENDING" | "AUTHORIZED" | "DECLINED"
  | "CAPTURED" | "VOIDED" | "EXPIRED" | "FAILED"
  | "SETTLED" | "REFUNDED" | "CHARGEBACK";

export type Ledger = { avail: number; held: number; merchant: number; fees: number };
export type Channel = "present" | "online";
export type CaptureMode = "separate" | "auto";
export type Scenario = { amount: number; channel: Channel; mode: CaptureMode };
export type Action = {
  label: string; to: LifecycleStatus; hops: Hop[];
  via?: LifecycleStatus[];      // statuses passed through on the way (auto-capture skips AUTHORIZED as a stop)
  apply: (l: Ledger) => Ledger;
  captures?: number;            // amount captured by this action
};

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
  PENDING: ["acc", "The card was tapped, dipped or typed in. The authorization request is on its way to the issuing bank and nothing is decided yet."],
  AUTHORIZED: ["hold", "The issuer approved and placed a hold. The money stays in the customer's account but can't be spent."],
  DECLINED: ["bad", "The issuer rejected it: insufficient funds, wrong card details or fraud detection. No funds are held."],
  CAPTURED: ["ok", "The merchant asked to collect the authorized funds and the sale joined today's batch. The customer still only sees a hold: the charge is posted when the batch is cleared."],
  VOIDED: ["idle", "Cancelled before capture by the merchant or processor. No funds move and the hold is released."],
  EXPIRED: ["idle", "Not captured within the allowed window (days to weeks, depending on network and merchant type). The authorization lapses and the hold is released."],
  FAILED: ["bad", "The capture attempt didn't go through: network issue, merchant processing error or bank rejection. The hold remains until it is retried or expires."],
  SETTLED: ["ok", "The batch was cleared (the issuer posted the charge to the cardholder) and settled (money moved from issuer to acquirer, minus fees). The merchant is paid out next."],
  REFUNDED: ["acc", "The merchant voluntarily returned the money to the customer. Processing fees are often not given back."],
  CHARGEBACK: ["bad", "The customer disputed with their issuer, which pulls the funds back from the merchant until the dispute is resolved. The merchant also pays a fee."],
};

/** Inline style that feeds a status's colour into the `--c` / `--cs` tokens used by .badge and .state. */
export const tone = (s: string): CSSProperties => {
  const [c, cs] = TONES[STATES[s as LifecycleStatus]?.[0] ?? "idle"];
  return { "--c": `var(${c})`, "--cs": `var(${cs})` } as CSSProperties;
};

// Illustrative fees: interchange 1.5%, scheme 0.15%, processor 0.5% + $0.10; $15 per chargeback.
const round = (v: number) => Math.round(v * 100) / 100;
export const feeOn = (amount: number) => round(amount * (0.015 + 0.0015 + 0.005) + 0.1);
const CHARGEBACK_FEE = 15;
export const PARTIAL = 0.8; // partial capture: e.g. one item was out of stock

export const START: Ledger = { avail: 1000, held: 0, merchant: 0, fees: 0 };

export const LEDGER_ROWS: [keyof Ledger, string, string][] = [
  ["avail", "Customer available", "spendable balance"],
  ["held", "Customer on hold", "authorized; becomes a posted charge at clearing"],
  ["merchant", "Merchant account", "net after fees"],
  ["fees", "Fees taken", "issuer, network, processor"],
];

const h = (route: string, text: string): Hop => ({ route, text });
const release = (l: Ledger): Ledger => ({ ...l, avail: round(l.avail + l.held), held: 0 });

/**
 * Actions available from a status for a scenario. `captured` is the amount captured so far
 * (0 before capture). "START" is before the card is used.
 */
export function actionsFor(status: LifecycleStatus | "START", sc: Scenario, captured: number): Action[] {
  const A = sc.amount, $ = money;
  const hold = (l: Ledger): Ledger => ({ ...l, avail: round(l.avail - A), held: A });
  const present = sc.channel === "present";
  const approveHops = [
    h("processor→network", "Processor routes the authorization request to the card network (Visa, Mastercard…)."),
    h("network→issuer", "Network forwards it to the cardholder's issuing bank."),
    h("issuer→network", `Issuer checks the balance or credit line and its fraud rules, approves and places a ${$(A)} hold.`),
    h("network→merchant", "Approval code travels back through network and processor to the merchant."),
  ];
  const toBatch = (amount: number) => h("processor→acquirer", `${$(amount)} is added to the merchant's open batch for today. Nothing is sent to the issuer yet.`);
  const capture = (label: string, amount: number, text: string): Action => ({
    label, to: "CAPTURED", captures: amount,
    apply: l => ({ ...l, avail: round(l.avail + l.held - amount), held: amount }), // any uncaptured part of the hold is released
    hops: [h("merchant→processor", text), toBatch(amount)],
  });

  switch (status) {
    case "START":
      return [{
        label: `Pay ${$(A)}`, to: "PENDING", apply: l => l,
        hops: present
          ? [h("customer→merchant", `Cardholder taps or inserts the card at the terminal for ${$(A)}. The chip creates a one-time cryptogram.`),
             h("merchant→processor", "Terminal sends the encrypted card data and amount to the processor.")]
          : [h("customer→merchant", `Cardholder types the card details at checkout for ${$(A)}. The bank may ask them to confirm in its app (3-D Secure).`),
             h("merchant→processor", "Checkout page sends tokenized card data and amount to the processor.")],
      }];
    case "PENDING":
      return [
        sc.mode === "auto"
          ? { label: "Issuer approves", to: "CAPTURED", via: ["AUTHORIZED"], captures: A, apply: hold,
              hops: [...approveHops, toBatch(A)] }
          : { label: "Issuer approves", to: "AUTHORIZED", apply: hold, hops: approveHops },
        { label: "Issuer declines", to: "DECLINED", apply: l => l, hops: [
          h("network→issuer", "Network forwards the request to the issuing bank."),
          h("issuer→merchant", "Issuer declines: insufficient funds, wrong card details or suspected fraud."),
        ] },
      ];
    case "AUTHORIZED":
      return [
        capture("Capture full amount", A, `Merchant ships the order (or the guest checks out) and captures ${$(A)}.`),
        capture("Capture less", round(A * PARTIAL), `Only part of the order ships. Merchant captures ${$(round(A * PARTIAL))}; the rest of the hold is released.`),
        { label: "Void", to: "VOIDED", apply: release, hops: [
          h("merchant→processor", "Merchant cancels the sale before capture."),
          h("processor→issuer", "Void travels through the network; the issuer releases the hold."),
        ] },
        { label: "Let it expire", to: "EXPIRED", apply: release, hops: [
          h("issuer→customer", "No capture arrived in time. The issuer drops the authorization and releases the hold."),
        ] },
        { label: "Capture fails", to: "FAILED", apply: l => l, hops: [
          h("merchant→processor", "Merchant sends a capture request."),
          h("processor→acquirer", "The request errors out: network issue or bank rejection. The hold stays."),
        ] },
      ];
    case "FAILED":
      return [
        capture("Retry capture", A, `Merchant retries the capture for ${$(A)}.`),
        { label: "Give up (expires)", to: "EXPIRED", apply: release, hops: [
          h("issuer→customer", "The authorization window closes and the hold is released."),
        ] },
      ];
    case "CAPTURED": {
      const fee = feeOn(captured);
      return [{
        label: "Close batch (clear + settle)", to: "SETTLED",
        apply: l => ({ ...l, held: 0, merchant: round(l.merchant + captured - fee), fees: round(l.fees + fee) }),
        hops: [
          h("merchant→acquirer", "Cut-off: the merchant's batch closes and the acquirer sends clearing records to the network."),
          h("network→issuer", `Clearing: the issuer receives the record and posts the ${$(captured)} charge to the cardholder. The hold is gone.`),
          h("issuer→network", "Settlement: the issuer sends the funds minus interchange to the network."),
          h("network→acquirer", "Network takes its scheme fee and pays the acquiring bank."),
          h("acquirer→merchant", `Acquirer and processor take their cut and pay the merchant ${$(captured - fee)}.`),
        ],
      }];
    }
    case "SETTLED":
      return [
        { label: "Merchant refunds", to: "REFUNDED", apply: l => ({ ...l, avail: round(l.avail + captured), merchant: round(l.merchant - captured) }), hops: [
          h("merchant→processor", "Merchant issues a full refund through the processor."),
          h("acquirer→issuer", "Funds flow back through acquirer and network to the issuer."),
          h("issuer→customer", `Cardholder gets ${$(captured)} back, typically within a few business days.`),
        ] },
        { label: "Customer disputes", to: "CHARGEBACK", apply: l => ({ ...l, avail: round(l.avail + captured), merchant: round(l.merchant - captured - CHARGEBACK_FEE), fees: round(l.fees + CHARGEBACK_FEE) }), hops: [
          h("customer→issuer", "Cardholder files a dispute with their bank."),
          h("issuer→network", "Issuer reverses the funds through the network."),
          h("acquirer→merchant", `Acquirer debits the merchant ${$(captured)} plus a ${$(CHARGEBACK_FEE)} chargeback fee.`),
        ] },
      ];
    default:
      return [];
  }
}
