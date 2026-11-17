// The card payment lifecycle as an XState machine: states, allowed events and their effect on the money.
// Presentation (button labels and the message hops the UI animates) is in `describe`.
import { assign, setup } from "xstate";
import type { Hop } from "../shared/parties.ts";
import { money } from "../shared/money.ts";
import { PARTIAL, START, feeOn, type LifecycleStatus, type Ledger, type Scenario } from "./model.ts";

export type Context = { scenario: Scenario; ledger: Ledger; captured: number; history: LifecycleStatus[] };

// Every event the user can trigger, in the order its buttons are shown (first one is the primary action).
export const EVENTS = [
  "PAY", "APPROVE", "DECLINE", "CAPTURE", "CAPTURE_PARTIAL", "VOID", "EXPIRE", "CAPTURE_FAIL",
  "RETRY", "GIVE_UP", "CLOSE_BATCH", "REFUND", "DISPUTE",
] as const;
export type UserEvent = { type: (typeof EVENTS)[number] };
type Event = UserEvent | { type: "SET_SCENARIO"; scenario: Scenario } | { type: "RESET" };

const CHARGEBACK_FEE = 15;
const round = (v: number) => Math.round(v * 100) / 100;
const ledger = (fn: (l: Ledger, c: Context) => Partial<Ledger>) =>
  assign({ ledger: ({ context: c }: { context: Context }) => ({ ...c.ledger, ...fn(c.ledger, c) }) });

export const paymentMachine = setup({
  types: { context: {} as Context, events: {} as Event, input: {} as Scenario },
  guards: {
    autoCapture: ({ context }) => context.scenario.mode === "auto",
  },
  actions: {
    record: assign({ history: ({ context }, p: { status: LifecycleStatus }) => [...context.history, p.status] }),
    reset: assign({ ledger: START, captured: 0, history: [] }),
    hold: ledger((l, c) => ({ avail: round(l.avail - c.scenario.amount), held: c.scenario.amount })),
    // Capturing less than the hold releases the rest back to the customer.
    capture: assign(({ context: c }, p: { share: number }) => {
      const amount = round(c.scenario.amount * p.share);
      return { captured: amount, ledger: { ...c.ledger, avail: round(c.ledger.avail + c.ledger.held - amount), held: amount } };
    }),
    release: ledger(l => ({ avail: round(l.avail + l.held), held: 0 })),
    // Clearing posts the charge (the hold disappears); settlement pays the merchant net of fees.
    settle: ledger((l, c) => ({ held: 0, merchant: round(l.merchant + c.captured - feeOn(c.captured)), fees: round(l.fees + feeOn(c.captured)) })),
    refund: ledger((l, c) => ({ avail: round(l.avail + c.captured), merchant: round(l.merchant - c.captured) })),
    chargeback: ledger((l, c) => ({
      avail: round(l.avail + c.captured), merchant: round(l.merchant - c.captured - CHARGEBACK_FEE), fees: round(l.fees + CHARGEBACK_FEE),
    })),
  },
}).createMachine({
  id: "payment",
  context: ({ input }) => ({ scenario: input, ledger: START, captured: 0, history: [] }),
  initial: "START",
  // Terminal states are tagged rather than `type: "final"`: a final root would stop the actor, and Start over must still work.
  on: { RESET: { target: ".START", actions: "reset" } },
  states: {
    START: {
      on: {
        SET_SCENARIO: { actions: assign({ scenario: ({ event }) => event.scenario }) },
        PAY: "PENDING",
      },
    },
    PENDING: {
      entry: { type: "record", params: { status: "PENDING" } },
      on: {
        APPROVE: { target: "AUTHORIZED", actions: "hold" },
        DECLINE: "DECLINED",
      },
    },
    AUTHORIZED: {
      entry: { type: "record", params: { status: "AUTHORIZED" } },
      // Automatic capture: the sale is captured the moment it is approved.
      always: { guard: "autoCapture", target: "CAPTURED", actions: { type: "capture", params: { share: 1 } } },
      on: {
        CAPTURE: { target: "CAPTURED", actions: { type: "capture", params: { share: 1 } } },
        CAPTURE_PARTIAL: { target: "CAPTURED", actions: { type: "capture", params: { share: PARTIAL } } },
        VOID: { target: "VOIDED", actions: "release" },
        EXPIRE: { target: "EXPIRED", actions: "release" },
        CAPTURE_FAIL: "FAILED",
      },
    },
    FAILED: {
      entry: { type: "record", params: { status: "FAILED" } },
      on: {
        RETRY: { target: "CAPTURED", actions: { type: "capture", params: { share: 1 } } },
        GIVE_UP: { target: "EXPIRED", actions: "release" },
      },
    },
    CAPTURED: {
      entry: { type: "record", params: { status: "CAPTURED" } },
      on: { CLOSE_BATCH: { target: "SETTLED", actions: "settle" } },
    },
    SETTLED: {
      entry: { type: "record", params: { status: "SETTLED" } },
      on: {
        REFUND: { target: "REFUNDED", actions: "refund" },
        DISPUTE: { target: "CHARGEBACK", actions: "chargeback" },
      },
    },
    DECLINED: { tags: "final", entry: { type: "record", params: { status: "DECLINED" } } },
    VOIDED: { tags: "final", entry: { type: "record", params: { status: "VOIDED" } } },
    EXPIRED: { tags: "final", entry: { type: "record", params: { status: "EXPIRED" } } },
    REFUNDED: { tags: "final", entry: { type: "record", params: { status: "REFUNDED" } } },
    CHARGEBACK: { tags: "final", entry: { type: "record", params: { status: "CHARGEBACK" } } },
  },
});

const h = (route: string, text: string): Hop => ({ route, text });

/** Button label and the messages between parties for an event, given where the payment is now. */
export function describe(type: UserEvent["type"], c: Context): { label: string; hops: Hop[] } {
  const A = c.scenario.amount, $ = money;
  const toBatch = (amount: number) => h("processor→acquirer", `${$(amount)} is added to the merchant's open batch for today. Nothing is sent to the issuer yet.`);
  const capture = (label: string, amount: number, text: string) => ({ label, hops: [h("merchant→processor", text), toBatch(amount)] });
  switch (type) {
    case "PAY": return {
      label: `Pay ${$(A)}`,
      hops: c.scenario.channel === "present"
        ? [h("customer→merchant", `Cardholder taps or inserts the card at the terminal for ${$(A)}. The chip creates a one-time cryptogram.`),
           h("merchant→processor", "Terminal sends the encrypted card data and amount to the processor.")]
        : [h("customer→merchant", `Cardholder types the card details at checkout for ${$(A)}. The bank may ask them to confirm in its app (3-D Secure).`),
           h("merchant→processor", "Checkout page sends tokenized card data and amount to the processor.")],
    };
    case "APPROVE": return {
      label: "Issuer approves",
      hops: [
        h("processor→network", "Processor routes the authorization request to the card network (Visa, Mastercard…)."),
        h("network→issuer", "Network forwards it to the cardholder's issuing bank."),
        h("issuer→network", `Issuer checks the balance or credit line and its fraud rules, approves and places a ${$(A)} hold.`),
        h("network→merchant", "Approval code travels back through network and processor to the merchant."),
        ...(c.scenario.mode === "auto" ? [toBatch(A)] : []),
      ],
    };
    case "DECLINE": return {
      label: "Issuer declines",
      hops: [h("network→issuer", "Network forwards the request to the issuing bank."),
             h("issuer→merchant", "Issuer declines: insufficient funds, wrong card details or suspected fraud.")],
    };
    case "CAPTURE": return capture("Capture full amount", A, `Merchant ships the order (or the guest checks out) and captures ${$(A)}.`);
    case "CAPTURE_PARTIAL": {
      const part = round(A * PARTIAL);
      return capture("Capture less", part, `Only part of the order ships. Merchant captures ${$(part)}; the rest of the hold is released.`);
    }
    case "VOID": return {
      label: "Void",
      hops: [h("merchant→processor", "Merchant cancels the sale before capture."),
             h("processor→issuer", "Void travels through the network; the issuer releases the hold.")],
    };
    case "EXPIRE": return { label: "Let it expire", hops: [h("issuer→customer", "No capture arrived in time. The issuer drops the authorization and releases the hold.")] };
    case "CAPTURE_FAIL": return {
      label: "Capture fails",
      hops: [h("merchant→processor", "Merchant sends a capture request."),
             h("processor→acquirer", "The request errors out: network issue or bank rejection. The hold stays.")],
    };
    case "RETRY": return capture("Retry capture", A, `Merchant retries the capture for ${$(A)}.`);
    case "GIVE_UP": return { label: "Give up (expires)", hops: [h("issuer→customer", "The authorization window closes and the hold is released.")] };
    case "CLOSE_BATCH": {
      const fee = feeOn(c.captured);
      return {
        label: "Close batch (clear + settle)",
        hops: [
          h("merchant→acquirer", "Cut-off: the merchant's batch closes and the acquirer sends clearing records to the network."),
          h("network→issuer", `Clearing: the issuer receives the record and posts the ${$(c.captured)} charge to the cardholder. The hold is gone.`),
          h("issuer→network", "Settlement: the issuer sends the funds minus interchange to the network."),
          h("network→acquirer", "Network takes its scheme fee and pays the acquiring bank."),
          h("acquirer→merchant", `Acquirer and processor take their cut and pay the merchant ${$(c.captured - fee)}.`),
        ],
      };
    }
    case "REFUND": return {
      label: "Merchant refunds",
      hops: [h("merchant→processor", "Merchant issues a full refund through the processor."),
             h("acquirer→issuer", "Funds flow back through acquirer and network to the issuer."),
             h("issuer→customer", `Cardholder gets ${$(c.captured)} back, typically within a few business days.`)],
    };
    case "DISPUTE": return {
      label: "Customer disputes",
      hops: [h("customer→issuer", "Cardholder files a dispute with their bank."),
             h("issuer→network", "Issuer reverses the funds through the network."),
             h("acquirer→merchant", `Acquirer debits the merchant ${$(c.captured)} plus a ${$(CHARGEBACK_FEE)} chargeback fee.`)],
    };
  }
}
