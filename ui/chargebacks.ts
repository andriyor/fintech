// Chargeback (dispute) model. Pure data and functions, so chargebacks.check.ts runs under plain Node.
// Simplified and illustrative: real reason codes, deadlines and fees vary by network and processor.

export type Hop = { route: string; text: string };
export type DisputeStatus = "NEEDS_RESPONSE" | "UNDER_REVIEW" | "WON" | "LOST" | "PRE_ARBITRATION" | "ARBITRATION";

export type Evidence = { id: string; label: string };
export type Reason = {
  id: string; code: string; name: string; story: string;
  evidence: Evidence[];
  winsWith: string[][]; // the dispute is won if any one of these evidence sets is fully submitted
  tip: string;
};

export const ORDER = 120;
export const DISPUTE_FEE = 15;
export const ARBITRATION_FEE = 500;
export const CARD_FEE = +(ORDER * 0.029 + 0.3).toFixed(2); // what a plain refund costs: the original fee isn't returned

export const REASONS: Reason[] = [
  {
    id: "fraud", code: "Visa 10.4 · fraud, card not present", name: "Fraud",
    story: "Cardholder says they never made this online purchase.",
    evidence: [
      { id: "3ds", label: "3-D Secure authentication on the payment" },
      { id: "avs", label: "AVS and CVV matched" },
      { id: "history", label: "Earlier undisputed orders from the same device / IP" },
      { id: "delivery", label: "Delivery to the cardholder's billing address" },
      { id: "chat", label: "Generic customer emails" },
    ],
    winsWith: [["3ds"], ["avs", "history"]],
    tip: "3-D Secure shifts fraud liability to the issuer. Without it, show the buyer has paid you before from the same device.",
  },
  {
    id: "notReceived", code: "Visa 13.1 · merchandise not received", name: "Not received",
    story: "Cardholder says the package never arrived.",
    evidence: [
      { id: "tracking", label: "Carrier tracking showing delivered" },
      { id: "address", label: "Delivery address matches the order" },
      { id: "ack", label: "Customer message confirming they got it" },
      { id: "photos", label: "Product photos" },
    ],
    winsWith: [["tracking", "address"], ["ack"]],
    tip: "Proof of delivery to the address the customer gave is what decides it.",
  },
  {
    id: "notAsDescribed", code: "Visa 13.3 · not as described", name: "Not as described",
    story: "Cardholder says the item was damaged or different from the listing.",
    evidence: [
      { id: "listing", label: "Listing text and photos at time of sale" },
      { id: "policy", label: "Return policy shown and accepted at checkout" },
      { id: "noReturn", label: "Customer never tried to return the item" },
      { id: "tracking", label: "Carrier tracking showing delivered" },
    ],
    winsWith: [["listing", "policy", "noReturn"]],
    tip: "Show the item matched the listing and that the customer skipped your return process.",
  },
  {
    id: "creditNotProcessed", code: "Visa 13.6 · credit not processed", name: "Refund not received",
    story: "Cardholder says they returned the item and never got their money back.",
    evidence: [
      { id: "refunded", label: "Proof the refund was already issued" },
      { id: "policy", label: "Return policy shown and accepted at checkout" },
      { id: "noReturn", label: "Warehouse log: no return received" },
    ],
    winsWith: [["refunded"], ["policy", "noReturn"]],
    tip: "If you already refunded, that alone wins. Otherwise prove no return arrived under the stated policy.",
  },
];

export const decide = (reason: Reason, submitted: string[]) =>
  reason.winsWith.some(set => set.every(id => submitted.includes(id)));

// Day offsets from the dispute being opened (purchase was ~35 days earlier).
export const DAYS = { respondBy: 7, issuerDecision: 45, preArb: 75, arbitration: 135 };

export type Entry = { label: string; amount: number };
export type Step = {
  label: string; to: DisputeStatus; day: number; hops: Hop[];
  entries: Entry[] | ((won: boolean) => Entry[]);
  decides?: boolean; // the outcome depends on the evidence
};

const h = (route: string, text: string): Hop => ({ route, text });

/** Actions from each status. Outcome-dependent steps resolve `to` and entries with `won`. */
export function stepsFrom(status: DisputeStatus | null, won: boolean, escalated: boolean): Step[] {
  switch (status) {
    case null:
      return [{
        label: "Customer disputes the charge", to: "NEEDS_RESPONSE", day: 0,
        entries: [{ label: "Chargeback debit", amount: -ORDER }, { label: "Dispute fee", amount: -DISPUTE_FEE }],
        hops: [
          h("customer→issuer", "Cardholder calls their bank and disputes the $120 charge."),
          h("issuer→network", "Issuer picks a reason code and files the chargeback with the card network."),
          h("network→acquirer", "Network moves the $120 back from the merchant's acquirer to the issuer immediately."),
          h("acquirer→processor", "Acquirer passes the debit and the dispute details to the processor."),
          h("processor→merchant", "Processor takes $120 + $15 fee from the merchant balance and opens a case: respond within 7 days."),
        ],
      }];
    case "NEEDS_RESPONSE":
      return [
        {
          label: "Submit evidence", to: "UNDER_REVIEW", day: 5, entries: [],
          hops: [
            h("merchant→processor", "Merchant uploads evidence and a short rebuttal letter."),
            h("processor→acquirer", "Processor packages it as a representment."),
            h("acquirer→network", "Acquirer submits it through the network."),
            h("network→issuer", "Issuer reviews the evidence against the reason code rules."),
          ],
        },
        {
          label: "Accept the dispute", to: "LOST", day: 2, entries: [],
          hops: [h("merchant→processor", "Merchant accepts. The cardholder keeps the money and the case closes.")],
        },
        {
          label: "Miss the deadline", to: "LOST", day: DAYS.respondBy, entries: [],
          hops: [h("processor→merchant", "No response by day 7. The dispute is lost automatically.")],
        },
      ];
    case "UNDER_REVIEW":
      return [{
        label: "Issuer decides", to: won ? "WON" : "LOST", day: DAYS.issuerDecision, decides: true,
        entries: won => (won ? [{ label: "Chargeback reversed", amount: ORDER }] : []),
        hops: [
          h("issuer→network", "Issuer rules on the evidence, which can take weeks."),
          h("network→acquirer", "The decision flows back through the network."),
          h("processor→merchant", won ? "Won: the $120 comes back. The $15 fee usually doesn't." : "Lost: the cardholder keeps the $120."),
        ],
      }];
    case "WON":
      return escalated ? [] : [{
        label: "Issuer files pre-arbitration", to: "PRE_ARBITRATION", day: DAYS.preArb,
        entries: [{ label: "Pre-arbitration debit", amount: -ORDER }],
        hops: [
          h("customer→issuer", "Cardholder sends new information and the issuer disagrees with the merchant's evidence."),
          h("issuer→acquirer", "Issuer files pre-arbitration: a second cycle. Funds are pulled back again."),
          h("processor→merchant", "Merchant must accept or escalate to the card network."),
        ],
      }];
    case "PRE_ARBITRATION":
      return [
        {
          label: "Escalate to network arbitration", to: "ARBITRATION", day: DAYS.preArb + 10, entries: [],
          hops: [
            h("merchant→processor", "Merchant decides to fight on, risking the arbitration fee."),
            h("acquirer→network", "Acquirer asks the card network to rule. The network's decision is final."),
          ],
        },
        {
          label: "Accept", to: "LOST", day: DAYS.preArb + 5, entries: [],
          hops: [h("merchant→processor", "Merchant accepts the pre-arbitration. The cardholder keeps the money.")],
        },
      ];
    case "ARBITRATION":
      return [{
        label: "Network rules", to: won ? "WON" : "LOST", day: DAYS.arbitration, decides: true,
        entries: won => (won ? [{ label: "Arbitration won, funds returned", amount: ORDER }] : [{ label: "Arbitration fee (loser pays)", amount: -ARBITRATION_FEE }]),
        hops: [
          h("network→issuer", "Network reviews both sides under its rules."),
          h("network→merchant", won ? "Network rules for the merchant. The issuer pays the arbitration fee." : "Network rules for the cardholder. The merchant pays a $500 arbitration fee."),
        ],
      }];
    default:
      return [];
  }
}

export const STATUS_INFO: Record<DisputeStatus, [string, string]> = {
  NEEDS_RESPONSE: ["--hold", "Money and fee already taken. The clock is running: respond before the processor's deadline (often 7–21 days)."],
  UNDER_REVIEW: ["--accent", "Evidence sent (representment). The issuer has weeks to decide; nothing to do but wait."],
  WON: ["--ok", "The issuer reversed the chargeback. The disputed amount comes back; the dispute fee usually doesn't."],
  LOST: ["--bad", "The cardholder keeps the money. The dispute still counts toward the merchant's chargeback ratio."],
  PRE_ARBITRATION: ["--hold", "Second cycle: the issuer rejects the representment and pulls the funds back again."],
  ARBITRATION: ["--bad", "The card network rules. Final, and the loser pays a large fee (here $500)."],
};

export const PHASES: [string, DisputeStatus[]][] = [
  ["1 · Chargeback", ["NEEDS_RESPONSE"]],
  ["2 · Representment", ["UNDER_REVIEW"]],
  ["3 · Decision", ["WON", "LOST"]],
  ["4 · Second cycle", ["PRE_ARBITRATION", "ARBITRATION"]],
];

/** Illustrative chargeback-ratio bands; networks' monitoring programs use their own, changing thresholds. */
export function ratioBand(ratio: number): [string, string] {
  if (ratio < 0.005) return ["--ok", "Healthy. Well under the levels card networks watch."];
  if (ratio < 0.009) return ["--hold", "Watch it. Processors start asking questions and may add a reserve."];
  if (ratio < 0.015) return ["--bad", "Network monitoring programs likely: monthly fines, higher fees, a remediation plan."];
  return ["--bad", "Excessive. Fines grow every month and the processor may close the account (and list it on MATCH)."];
}
