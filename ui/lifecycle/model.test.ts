import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createActor } from "xstate";
import { EVENTS, paymentMachine, type UserEvent } from "./machine";
import { PARTIAL, PHASES, START, feeOn, type Ledger, type Scenario } from "./model";

const total = (l: Ledger) => Math.round((l.avail + l.held + l.merchant + l.fees) * 100) / 100;

function play(sc: Scenario, path: UserEvent["type"][]) {
  const actor = createActor(paymentMachine, { input: sc }).start();
  for (const type of path) {
    assert.ok(actor.getSnapshot().can({ type }), `${type} allowed after ${path}`);
    actor.send({ type });
  }
  return actor.getSnapshot();
}

// Breadth-first walk over every event sequence the machine allows.
function explore(sc: Scenario) {
  const seen = new Set<string>();
  const queue: UserEvent["type"][][] = [[]];
  while (queue.length) {
    const path = queue.shift()!;
    const snap = play(sc, path);
    seen.add(String(snap.value));
    assert.equal(total(snap.context.ledger), total(START), `money is conserved after ${path}`);
    const next = EVENTS.filter(type => snap.can({ type }));
    assert.equal(next.length === 0, snap.hasTag("final"), `${snap.value}: only final states are dead ends`);
    for (const type of next) queue.push([...path, type]);
  }
  return seen;
}

describe("payment lifecycle machine", () => {
  it("reaches every status, conserves money and has no dead ends (separate capture)", () => {
    const seen = explore({ amount: 100, channel: "online", mode: "separate" });
    assert.deepEqual([...seen].filter(s => s !== "START").sort(), PHASES.flatMap(([, s]) => s).sort());
  });

  it("never stops at AUTHORIZED with automatic capture", () => {
    assert.ok(!explore({ amount: 100, channel: "online", mode: "auto" }).has("AUTHORIZED"));
    const s = play({ amount: 100, channel: "present", mode: "auto" }, ["PAY", "APPROVE"]);
    assert.equal(s.value, "CAPTURED");
    assert.deepEqual(s.context.history, ["PENDING", "AUTHORIZED", "CAPTURED"], "but still passes through it");
  });

  it("releases the uncaptured part of the hold on a partial capture", () => {
    const s = play({ amount: 100, channel: "online", mode: "separate" }, ["PAY", "APPROVE", "CAPTURE_PARTIAL", "CLOSE_BATCH"]);
    assert.equal(s.context.captured, 100 * PARTIAL);
    assert.equal(s.context.ledger.avail, 1000 - 80);
    assert.equal(s.context.ledger.merchant, Math.round((80 - feeOn(80)) * 100) / 100);
  });

  it("returns a chargeback to the cardholder, locks the scenario and resets", () => {
    const actor = createActor(paymentMachine, { input: { amount: 100, channel: "online", mode: "separate" } }).start();
    for (const type of ["PAY", "APPROVE", "CAPTURE", "CLOSE_BATCH", "DISPUTE"] as const) actor.send({ type });
    assert.equal(actor.getSnapshot().context.ledger.avail, 1000);
    actor.send({ type: "SET_SCENARIO", scenario: { amount: 5, channel: "online", mode: "auto" } });
    assert.equal(actor.getSnapshot().context.scenario.amount, 100, "scenario is locked once the payment started");
    actor.send({ type: "RESET" });
    assert.equal(actor.getSnapshot().value, "START");
    assert.deepEqual(actor.getSnapshot().context.ledger, START);
  });
});
