// A card dispute as an XState machine: two cycles (chargeback → representment, then pre-arbitration →
// arbitration), decisions guarded by the evidence, and the money the merchant loses or gets back.
import { assign, setup } from "xstate";
import type { Hop } from "../shared/parties";
import { ARBITRATION_FEE, DAYS, DISPUTE_FEE, ORDER, REASONS, decide, type DisputeStatus, type Entry } from "./model";

export type TimelineItem = { day: number; status: DisputeStatus; label: string };
export type Context = { reasonId: string; evidence: string[]; entries: Entry[]; timeline: TimelineItem[] };

// User actions in button order (first one is the primary action).
export const EVENTS = [
  "DISPUTE", "SUBMIT", "ISSUER_DECIDES", "PRE_ARB", "ESCALATE", "NETWORK_RULES", "ACCEPT", "ACCEPT_PRE_ARB", "MISS_DEADLINE",
] as const;
export type UserEvent = { type: (typeof EVENTS)[number] };
type Event = UserEvent | { type: "SET_REASON"; reasonId: string } | { type: "TOGGLE_EVIDENCE"; id: string } | { type: "RESET" };

export const LABELS: Record<UserEvent["type"], string> = {
  DISPUTE: "Customer disputes the charge",
  SUBMIT: "Submit evidence",
  ISSUER_DECIDES: "Issuer decides",
  PRE_ARB: "Issuer files pre-arbitration",
  ESCALATE: "Escalate to network arbitration",
  NETWORK_RULES: "Network rules",
  ACCEPT: "Accept the dispute",
  ACCEPT_PRE_ARB: "Accept",
  MISS_DEADLINE: "Miss the deadline",
};

export const wins = (c: Context) => decide(REASONS.find(r => r.id === c.reasonId)!, c.evidence);
const log = (status: DisputeStatus, day: number) => ({ type: "log", params: { status, day } }) as const;
const money = (label: string, amount: number) => ({ type: "book", params: { label, amount } }) as const;
const toggle = { actions: "toggleEvidence" } as const;

export const disputeMachine = setup({
  types: { context: {} as Context, events: {} as Event },
  guards: { wins: ({ context }) => wins(context) },
  actions: {
    log: assign({
      timeline: ({ context, event }, p: { status: DisputeStatus; day: number }) =>
        [...context.timeline, { ...p, label: LABELS[event.type as UserEvent["type"]] }],
    }),
    book: assign({ entries: ({ context }, p: Entry) => [...context.entries, p] }),
    toggleEvidence: assign({
      evidence: ({ context, event }) => {
        if (event.type !== "TOGGLE_EVIDENCE") return context.evidence;
        return context.evidence.includes(event.id) ? context.evidence.filter(x => x !== event.id) : [...context.evidence, event.id];
      },
    }),
  },
}).createMachine({
  id: "dispute",
  context: { reasonId: REASONS[0].id, evidence: [], entries: [], timeline: [] },
  initial: "START",
  // Terminal states are tagged instead of `type: "final"` so the actor keeps running and RESET still works.
  on: { RESET: { target: ".START", actions: assign({ entries: [], timeline: [] }) } },
  states: {
    START: {
      on: {
        SET_REASON: { actions: assign({ reasonId: ({ event }) => event.reasonId, evidence: [] }) },
        TOGGLE_EVIDENCE: toggle,
        DISPUTE: {
          target: "NEEDS_RESPONSE",
          actions: [log("NEEDS_RESPONSE", 0), money("Chargeback debit", -ORDER), money("Dispute fee", -DISPUTE_FEE)],
        },
      },
    },
    // First cycle: the merchant may change its evidence until it responds.
    NEEDS_RESPONSE: {
      on: {
        TOGGLE_EVIDENCE: toggle,
        SUBMIT: { target: "UNDER_REVIEW", actions: log("UNDER_REVIEW", 5) },
        ACCEPT: { target: "LOST", actions: log("LOST", 2) },
        MISS_DEADLINE: { target: "LOST", actions: log("LOST", DAYS.respondBy) },
      },
    },
    UNDER_REVIEW: {
      on: {
        ISSUER_DECIDES: [
          { guard: "wins", target: "WON", actions: [log("WON", DAYS.issuerDecision), money("Chargeback reversed", ORDER)] },
          { target: "LOST", actions: log("LOST", DAYS.issuerDecision) },
        ],
      },
    },
    WON: {
      on: { PRE_ARB: { target: "PRE_ARBITRATION", actions: [log("PRE_ARBITRATION", DAYS.preArb), money("Pre-arbitration debit", -ORDER)] } },
    },
    // Second cycle: the merchant can strengthen its evidence before escalating.
    PRE_ARBITRATION: {
      on: {
        TOGGLE_EVIDENCE: toggle,
        ESCALATE: { target: "ARBITRATION", actions: log("ARBITRATION", DAYS.preArb + 10) },
        ACCEPT_PRE_ARB: { target: "LOST", actions: log("LOST", DAYS.preArb + 5) },
      },
    },
    ARBITRATION: {
      on: {
        NETWORK_RULES: [
          { guard: "wins", target: "WON_FINAL", actions: [log("WON", DAYS.arbitration), money("Arbitration won, funds returned", ORDER)] },
          { target: "LOST", actions: [log("LOST", DAYS.arbitration), money("Arbitration fee (loser pays)", -ARBITRATION_FEE)] },
        ],
      },
    },
    LOST: { tags: "final" },
    WON_FINAL: { tags: "final" }, // won in arbitration: the network's ruling can't be appealed
  },
});

const h = (route: string, text: string): Hop => ({ route, text });

/** Messages between parties for an event. Decisions read the evidence to tell how they go. */
export function hopsFor(type: UserEvent["type"], c: Context): Hop[] {
  const won = wins(c);
  switch (type) {
    case "DISPUTE": return [
      h("customer→issuer", "Cardholder calls their bank and disputes the $120 charge."),
      h("issuer→network", "Issuer picks a reason code and files the chargeback with the card network."),
      h("network→acquirer", "Network moves the $120 back from the merchant's acquirer to the issuer immediately."),
      h("acquirer→processor", "Acquirer passes the debit and the dispute details to the processor."),
      h("processor→merchant", "Processor takes $120 + $15 fee from the merchant balance and opens a case: respond within 7 days."),
    ];
    case "SUBMIT": return [
      h("merchant→processor", "Merchant uploads evidence and a short rebuttal letter."),
      h("processor→acquirer", "Processor packages it as a representment."),
      h("acquirer→network", "Acquirer submits it through the network."),
      h("network→issuer", "Issuer reviews the evidence against the reason code rules."),
    ];
    case "ACCEPT": return [h("merchant→processor", "Merchant accepts. The cardholder keeps the money and the case closes.")];
    case "MISS_DEADLINE": return [h("processor→merchant", "No response by day 7. The dispute is lost automatically.")];
    case "ISSUER_DECIDES": return [
      h("issuer→network", "Issuer rules on the evidence, which can take weeks."),
      h("network→acquirer", "The decision flows back through the network."),
      h("processor→merchant", won ? "Won: the $120 comes back. The $15 fee usually doesn't." : "Lost: the cardholder keeps the $120."),
    ];
    case "PRE_ARB": return [
      h("customer→issuer", "Cardholder sends new information and the issuer disagrees with the merchant's evidence."),
      h("issuer→acquirer", "Issuer files pre-arbitration: a second cycle. Funds are pulled back again."),
      h("processor→merchant", "Merchant must accept or escalate to the card network."),
    ];
    case "ESCALATE": return [
      h("merchant→processor", "Merchant decides to fight on, risking the arbitration fee."),
      h("acquirer→network", "Acquirer asks the card network to rule. The network's decision is final."),
    ];
    case "ACCEPT_PRE_ARB": return [h("merchant→processor", "Merchant accepts the pre-arbitration. The cardholder keeps the money.")];
    case "NETWORK_RULES": return [
      h("network→issuer", "Network reviews both sides under its rules."),
      h("network→merchant", won ? "Network rules for the merchant. The issuer pays the arbitration fee." : "Network rules for the cardholder. The merchant pays a $500 arbitration fee."),
    ];
  }
}
