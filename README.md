# Fintech basic

<img src="docs/basic.svg">

## Terms

**Payment Processor**

A payment processor is a company that handles transactions between merchants, acquiring banks, and card networks (Visa, Mastercard, etc.). It facilitates the movement of funds and ensures that payments are securely processed.

A payment processor is the middleman that securely moves transaction data between the merchant, acquiring bank, card networks, and issuing bank.

The payment processor is responsible for:

- Transmitting transaction data between the merchant, acquiring bank, and card network
- Encrypting sensitive payment information to prevent fraud
- Handling authorization requests from card issuers
- Ensuring compliance with security standards (PCI DSS)
- Managing refunds, voids, and chargebacks

Examples of Payment Processors: Stripe, PayPal, Square, Adyen, Worldpay, Fiserv, Authorize.net

**Refund**

A refund is when a merchant voluntarily returns the transaction amount to the customer, typically due to a return, dissatisfaction, or an issue with the product/service.

**Chargeback**

A chargeback is when a customer files a dispute with their issuing bank, asking them to forcibly reverse the transaction.
Merchants should prioritize refunds to avoid chargebacks whenever possible.

**Gross Payments**

Gross Income/Revenue: The total amount of money earned before deductions like taxes, expenses, or costs.

**Net Payment**

Amount of money an individual or entity receives after all deductions, such as taxes, fees, and other withholdings, have been subtracted from the total (gross) amount.

### Resources

[Interchange in 1,000 words - Matt Brown's Notes](https://notes.mtb.xyz/p/interchange-in-1000-words)

[Payfac in 1,000 words - Matt Brown's Notes](https://notes.mtb.xyz/p/payfac-1000-words)


## Interactive UI

`ui/` is a small app that explains the concepts above by simulation: payment lifecycle, fraud and risk scoring,
settlement, payouts, chargebacks and double-entry bookkeeping, a glossary of the terms they use, plus the aggregates computed from
`transactions/`.

```sh
pnpm install
pnpm dev     # local dev server
pnpm test    # model tests in watch mode
pnpm check   # model tests once (CI)
pnpm build   # static site in dist/
pnpm report  # PDF of the aggregates in transactions/ (page.pdf); needs `pnpm exec playwright install chromium` once
```

| Path | What it is |
|---|---|
| `ui/` | The interactive app (Vite root), one folder per tab |
| `report/` | The PDF report: transaction types, aggregates (`single-pass`, `multi-pass`) and the script |
| `transactions/` | Sample transactions read by the report and the Repo data tab |
| `docs/` | Images for this README |

## Technical decisions

- **Vite + React, no router or UI kit.** Tabs are switched by URL hash (`#settlement`); styling is one CSS file
  with light/dark tokens. The app is a teaching tool, so fewer moving parts beat flexibility.
- **One folder per tab.** Each of `ui/lifecycle`, `fraud`, `settlement`, `payouts`, `chargebacks`, `ledger` holds its
  model, tests and components; `ui/terms` is the glossary; `ui/shared` holds what several tabs use (`Actors`,
  `Toggle`, `MachineDiagram`, `money`, icons). The Repo data tab reuses the PDF report's types and
  aggregate from `report/` instead of copying them.
- **Logic in plain `.ts` models, UI in components.** Models have no React code, so they are tested without a
  DOM and stay readable as the "rules" of each concept.
- **Vitest for invariant tests.** Each `model.test.ts` asserts what makes the explanation true: money is
  conserved, debits equal credits, payouts reconcile to activity, fee splits add up to the sale. Vitest reuses
  the Vite config (same import resolution as the app), reports every failing case instead of stopping at the
  first, and has a watch mode. Tests use `node:assert` so the failure messages read as the invariant.
- **XState for the two flows that are state machines.** The payment lifecycle and the chargeback dispute are
  XState v5 machines (`machine.ts`). The machine is the single source of rules: the UI renders only the events
  `snapshot.can()` allows, guards decide outcomes (auto-capture, evidence wins the dispute), and locks such as
  "scenario can't change once paid" are transitions the machine refuses. Because the rules are data, the
  tests walk every reachable path and fail on an unreachable status, a dead end that isn't final, or
  money created or lost. Trade-offs: ~14 KB gzipped, some typing ceremony, and terminal states are tagged
  `final` rather than `type: "final"` so the actor keeps running and "Start over" works.
- **Diagrams are generated from the machines.** `shared/graph.ts` reads the top-level states (grouped into
  columns by `meta.phase`) and their transitions from the XState definition, merging every event between the
  same two states into one arrow. `MachineDiagram` keeps the states as HTML buttons and draws the arrows in SVG
  underneath from their measured positions, so the layout stays responsive. The arrows the machine accepts now
  are numbered like their buttons (readable without hover, on touch screens too), and hovering a button or an
  arrow highlights the other and shows the full label. A diagram drawn by hand would drift from the rules; a
  graph-layout library would be heavier than the few phases each flow has.
- **Not everything is a machine.** Payouts derive their status from dates, settlement is a fixed stepper,
  the ledger replays an event list into journal entries (event sourcing) and fraud scoring is a pure function. Forcing those into XState would add
  code without adding rules.
- **Explainable fraud scoring over a seeded sample.** The score is additive points (weighted by how much
  likelier each signal is on fraud) rather than a model, so every point can be shown. The threshold trade-off
  runs over 2,000 payments generated with a seeded PRNG from the same signal rates, so the numbers are the
  same on every load and tests can assert them; challenge outcomes are expected values, not random draws.
- **Money in integers where totals must balance exactly.** The ledger works in cents; other models round to
  cents at each step and assert totals within half a cent.
- **One icon per topic.** Icons come from `lucide-react` (tree-shaken, decorative so `aria-hidden` next to a text
  label). `shared/icons.ts` maps each topic to one icon, used for its tab and its glossary heading, so a topic
  always looks the same.
- **Illustrative numbers.** Fees, interchange rates, reason codes and deadlines are simplified and labelled as
  such in the UI; they explain the mechanics, not any one processor's pricing.
