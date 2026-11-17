// Self-check for the payment lifecycle: `pnpm check`.
import assert from "node:assert/strict";
import { PARTIAL, START, actionsFor, feeOn, type LifecycleStatus, type Scenario } from "./model.ts";

const total = (l: typeof START) => Math.round((l.avail + l.held + l.merchant + l.fees) * 100) / 100;

// Walk a path by action label; money is never created or lost along the way.
function walk(sc: Scenario, labels: string[]) {
  let status: LifecycleStatus | "START" = "START", ledger = START, captured = 0;
  const history: LifecycleStatus[] = [];
  for (const label of labels) {
    const a = actionsFor(status, sc, captured).find(x => x.label === label || x.label.startsWith(label));
    assert.ok(a, `"${label}" is available from ${status}`);
    ledger = a.apply(ledger);
    if (a.captures !== undefined) captured = a.captures;
    history.push(...(a.via ?? []), a.to);
    status = a.to;
    assert.equal(total(ledger), total(START), `money is conserved after "${label}"`);
  }
  return { status, ledger, captured, history };
}

const auto: Scenario = { amount: 100, channel: "present", mode: "auto" };
const sep: Scenario = { amount: 100, channel: "online", mode: "separate" };

let r = walk(auto, ["Pay", "Issuer approves"]);
assert.equal(r.status, "CAPTURED");
assert.deepEqual(r.history, ["PENDING", "AUTHORIZED", "CAPTURED"], "auto-capture passes through AUTHORIZED");

r = walk(sep, ["Pay", "Issuer approves", "Capture less", "Close batch"]);
assert.equal(r.captured, 100 * PARTIAL);
assert.equal(r.ledger.avail, 1000 - 80, "uncaptured part of the hold went back to the customer");
assert.equal(r.ledger.merchant, Math.round((80 - feeOn(80)) * 100) / 100);

r = walk(sep, ["Pay", "Issuer approves", "Void"]);
assert.equal(r.ledger.avail, 1000);

r = walk(sep, ["Pay", "Issuer approves", "Capture fails", "Retry capture", "Close batch", "Customer disputes"]);
assert.equal(r.ledger.avail, 1000, "chargeback returns the money to the cardholder");
assert.equal(r.status, "CHARGEBACK");
assert.equal(actionsFor("CHARGEBACK", sep, 100).length, 0);
console.log("lifecycle.check: ok");
