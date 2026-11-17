import type { CSSProperties } from "react";

export type LifecycleStatus =
  | "PENDING" | "AUTHORIZED" | "DECLINED"
  | "CAPTURED" | "VOIDED" | "EXPIRED" | "FAILED"
  | "SETTLED" | "REFUNDED" | "CHARGEBACK";

export type Ledger = { avail: number; held: number; merchant: number; fees: number };
export type Channel = "present" | "online";
export type CaptureMode = "separate" | "auto";
export type Scenario = { amount: number; channel: Channel; mode: CaptureMode };

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

// Illustrative fees: interchange 1.5%, scheme 0.15%, processor 0.5% + $0.10.
const round = (v: number) => Math.round(v * 100) / 100;
export const feeOn = (amount: number) => round(amount * (0.015 + 0.0015 + 0.005) + 0.1);
export const PARTIAL = 0.8; // partial capture: e.g. one item was out of stock

export const START: Ledger = { avail: 1000, held: 0, merchant: 0, fees: 0 };

export const LEDGER_ROWS: [keyof Ledger, string, string][] = [
  ["avail", "Customer available", "spendable balance"],
  ["held", "Customer on hold", "authorized; becomes a posted charge at clearing"],
  ["merchant", "Merchant account", "net after fees"],
  ["fees", "Fees taken", "issuer, network, processor"],
];
