// Self-check for the chargeback model: `pnpm check`.
import assert from "node:assert/strict";
import { ARBITRATION_FEE, DISPUTE_FEE, ORDER, REASONS, decide, ratioBand, stepsFrom, type DisputeStatus } from "./chargebacks.ts";

const fraud = REASONS.find(r => r.id === "fraud")!;
assert.equal(decide(fraud, ["3ds"]), true, "3-D Secure alone wins fraud");
assert.equal(decide(fraud, ["avs"]), false, "AVS alone is not enough");
assert.equal(decide(fraud, ["avs", "history", "chat"]), true);

// Every evidence id used in a winning set must be offered to the user.
for (const r of REASONS) for (const set of r.winsWith) for (const id of set)
  assert.ok(r.evidence.some(e => e.id === id), `${r.id}: ${id} is selectable`);

// Walk a path, summing ledger entries, and check the merchant's final cost.
function walk(won: boolean, labels: string[]) {
  let status: DisputeStatus | null = null, total = 0, escalated = false;
  for (const label of labels) {
    const step = stepsFrom(status, won, escalated).find(s => s.label === label);
    assert.ok(step, `step "${label}" exists from ${status}`);
    const entries = typeof step.entries === "function" ? step.entries(won) : step.entries;
    total += entries.reduce((a, e) => a + e.amount, 0);
    if (step.to === "PRE_ARBITRATION") escalated = true;
    status = step.to;
  }
  return { status, total };
}
assert.deepEqual(walk(false, ["Customer disputes the charge", "Accept the dispute"]), { status: "LOST", total: -ORDER - DISPUTE_FEE });
assert.deepEqual(walk(true, ["Customer disputes the charge", "Submit evidence", "Issuer decides"]), { status: "WON", total: -DISPUTE_FEE });
assert.deepEqual(
  walk(false, ["Customer disputes the charge", "Submit evidence", "Issuer decides"]),
  { status: "LOST", total: -ORDER - DISPUTE_FEE },
);
// Won first cycle, then pre-arb and arbitration: the evidence outcome stays the same in both cycles.
assert.deepEqual(
  walk(true, ["Customer disputes the charge", "Submit evidence", "Issuer decides", "Issuer files pre-arbitration", "Escalate to network arbitration", "Network rules"]),
  { status: "WON", total: -DISPUTE_FEE },
);
// Lost arbitration (evidence changed between cycles is not modelled; outcome follows the evidence).
assert.equal(
  walk(false, ["Customer disputes the charge", "Submit evidence", "Issuer decides"]).status, "LOST",
  "weak evidence loses the first cycle, so no second cycle",
);
assert.equal(stepsFrom("WON", true, true).length, 0, "after arbitration a win is final");
assert.ok(ARBITRATION_FEE > ORDER);

assert.equal(ratioBand(0.002)[0], "--ok");
assert.equal(ratioBand(0.02)[0], "--bad");
console.log("chargebacks.check: ok");
