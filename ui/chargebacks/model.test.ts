import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createActor } from "xstate";
import { EVENTS, disputeMachine, type UserEvent } from "./machine";
import { ARBITRATION_FEE, DISPUTE_FEE, ORDER, PHASES, REASONS, decide, ratioBand } from "./model";

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

describe("dispute evidence", () => {
  it("wins fraud with 3-D Secure, or AVS plus history", () => {
    const fraud = REASONS.find(r => r.id === "fraud")!;
    assert.equal(decide(fraud, ["3ds"]), true);
    assert.equal(decide(fraud, ["avs"]), false, "AVS alone is not enough");
    assert.equal(decide(fraud, ["avs", "history", "chat"]), true);
  });

  it("offers every evidence item a winning set needs", () => {
    for (const r of REASONS) for (const set of r.winsWith) for (const id of set)
      assert.ok(r.evidence.some(e => e.id === id), `${r.id}: ${id} is selectable`);
  });
});

describe("dispute machine", () => {
  it("reaches every status, has no dead ends and caps the cost", () => {
    const seen = new Set<string>();
    for (const evidence of [["3ds"], []]) {
      const queue: UserEvent["type"][][] = [[]];
      while (queue.length) {
        const path = queue.shift()!;
        const { snap, cost, status } = play(evidence, path);
        if (status) seen.add(status);
        const next = EVENTS.filter(type => snap.can({ type }));
        assert.equal(next.length === 0, snap.hasTag("final"), `${snap.value}: only final states are dead ends`);
        if (!next.length) assert.ok(cost >= -ORDER - DISPUTE_FEE - ARBITRATION_FEE, `${path} costs at most order + both fees`);
        for (const type of next) queue.push([...path, type]);
      }
    }
    assert.deepEqual([...seen].sort(), PHASES.flatMap(([, s]) => s).sort());
  });

  it("charges the merchant what each outcome costs", () => {
    assert.equal(play([], ["DISPUTE", "ACCEPT"]).cost, -ORDER - DISPUTE_FEE);
    assert.equal(play(["3ds"], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES"]).cost, -DISPUTE_FEE, "a win returns the order but not the fee");
    assert.equal(play(["3ds"], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES", "PRE_ARB", "ESCALATE", "NETWORK_RULES"]).cost, -DISPUTE_FEE);
  });

  it("ends after a lost first cycle", () => {
    const { snap, status } = play([], ["DISPUTE", "SUBMIT", "ISSUER_DECIDES"]);
    assert.equal(status, "LOST");
    assert.ok(!snap.can({ type: "PRE_ARB" }));
  });

  it("loses arbitration when evidence is dropped in pre-arbitration, and resets", () => {
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
  });
});

describe("chargeback ratio", () => {
  it("bands ratios from healthy to excessive", () => {
    assert.equal(ratioBand(0.002)[0], "--ok");
    assert.equal(ratioBand(0.02)[0], "--bad");
  });
});
