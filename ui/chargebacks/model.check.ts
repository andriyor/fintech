// Self-check for the chargeback model and machine: `pnpm check`.
// Explores every path for winning and losing evidence: reachability, dead ends and the merchant's final cost.
import assert from "node:assert/strict";
import { createActor } from "xstate";
import { EVENTS, disputeMachine, type UserEvent } from "./machine.ts";
import { ARBITRATION_FEE, DISPUTE_FEE, ORDER, PHASES, REASONS, decide, ratioBand } from "./model.ts";

const fraud = REASONS.find(r => r.id === "fraud")!;
assert.equal(decide(fraud, ["3ds"]), true, "3-D Secure alone wins fraud");
assert.equal(decide(fraud, ["avs"]), false, "AVS alone is not enough");
assert.equal(decide(fraud, ["avs", "history", "chat"]), true);

// Every evidence id used in a winning set must be offered to the user.
for (const r of REASONS) for (const set of r.winsWith) for (const id of set)
  assert.ok(r.evidence.some(e => e.id === id), `${r.id}: ${id} is selectable`);

function play(evidence: string[], path: UserEvent["type"][]) {
  const actor = createActor(disputeMachine).start();
  actor.send({ type: "SET_REASON", reasonId: "fraud" });
  for (const id of evidence) actor.send({ type: "TOGGLE_EVIDENCE", id });
  for (const type of path) {
    assert.ok(actor.getSnapshot().can({ type }), `${type} allowed after ${path}`);
    actor.send({ type });
  }
  const snap = actor.getSnapshot();
  return { snap, cost: snap.context.entries.reduce((a, e) => a + e.amount, 0), status: snap.context.timeline.at(-1)?.status };
}

const seen = new Set<string>();
const ends = new Map<string, number>(); // path → merchant cost at a terminal state
for (const evidence of [["3ds"], []]) {
  const queue: UserEvent["type"][][] = [[]];
  while (queue.length) {
    const path = queue.shift()!;
    const { snap, cost, status } = play(evidence, path);
    if (status) seen.add(status);
    const next = EVENTS.filter(type => snap.can({ type }));
    assert.equal(next.length === 0, snap.hasTag("final"), `${snap.value}: only final states are dead ends`);
    if (!next.length) ends.set(`${evidence}:${path}`, cost);
    for (const type of next) queue.push([...path, type]);
  }
}
assert.deepEqual([...seen].sort(), PHASES.flatMap(([, s]) => s).sort(), "every status is reachable");

const cost = (evidence: string[], path: UserEvent["type"][]) => play(evidence, path).cost;
assert.equal(cost([], ["DISPUTE", "ACCEPT"]), -ORDER - DISPUTE_FEE);
assert.equal(cost(["3ds"], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES"]), -DISPUTE_FEE, "a win returns the order but not the fee");
assert.equal(play([], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES"]).status, "LOST", "weak evidence loses the first cycle");
assert.ok(!play([], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES"]).snap.can({ type: "PRE_ARB" }), "no second cycle after a loss");
assert.equal(cost(["3ds"], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES", "PRE_ARB", "ESCALATE", "NETWORK_RULES"]), -DISPUTE_FEE);
for (const [path, c] of ends) assert.ok(c >= -ORDER - DISPUTE_FEE - ARBITRATION_FEE, `${path} costs at most order + both fees`);

// Removing the winning evidence during pre-arbitration loses arbitration and costs the fee.
const actor = createActor(disputeMachine).start();
actor.send({ type: "TOGGLE_EVIDENCE", id: "3ds" });
for (const type of ["DISPUTE", "SUBMIT", "ISSUER_DECIDES", "PRE_ARB"] as const) actor.send({ type });
actor.send({ type: "TOGGLE_EVIDENCE", id: "3ds" });
actor.send({ type: "ESCALATE" });
assert.ok(!actor.getSnapshot().can({ type: "TOGGLE_EVIDENCE", id: "3ds" }), "evidence is locked during arbitration");
actor.send({ type: "NETWORK_RULES" });
assert.equal(actor.getSnapshot().context.entries.reduce((a, e) => a + e.amount, 0), -ORDER - DISPUTE_FEE - ARBITRATION_FEE);
actor.send({ type: "RESET" });
assert.equal(actor.getSnapshot().value, "START");
assert.deepEqual(actor.getSnapshot().context.entries, []);

assert.equal(ratioBand(0.002)[0], "--ok");
assert.equal(ratioBand(0.02)[0], "--bad");
console.log("chargebacks.check: ok");
