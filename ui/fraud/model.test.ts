import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  BASE,
  CHALLENGE,
  NEVER,
  PRESETS,
  SAMPLE,
  SIGNALS,
  cheapest,
  decide,
  outcome,
  sample,
  score,
  type Decision,
  type Thresholds,
} from "./model";

const payments = sample();

describe("risk score", () => {
  it("adds up its parts and stays within 0–100", () => {
    assert.equal(score([]).score, BASE);
    assert.equal(
      score(SIGNALS.map(s => s.id)).score,
      100,
      "every signal on is exactly 100, so no capping hides points",
    );
    for (const [, on] of PRESETS) {
      const s = score(on);
      assert.equal(s.score, BASE + s.parts.reduce((a, p) => a + p.points, 0));
    }
  });

  it("only goes up when a signal is added", () => {
    for (const s of SIGNALS) assert.ok(score([s.id]).score > score([]).score, s.id);
  });

  it("uses only signals that are likelier on fraud than on genuine payments", () => {
    for (const s of SIGNALS) assert.ok(s.fraud > s.legit, `${s.id} is likelier on fraud`);
  });

  it("puts each score in exactly one band", () => {
    const t = { challenge: 30, decline: 70 };
    assert.equal(decide(29, t), "approve");
    assert.equal(decide(30, t), "challenge");
    assert.equal(decide(70, t), "decline");
    assert.equal(decide(100, { challenge: NEVER, decline: NEVER }), "approve");
  });
});

describe("sample", () => {
  it("is the same on every load", () => {
    assert.deepEqual(sample(), payments);
  });

  it("scores fraud higher than genuine payments on average", () => {
    const avg = (f: boolean) => {
      const xs = payments.filter(p => p.fraud === f);
      return xs.reduce((a, p) => a + p.score, 0) / xs.length;
    };
    assert.ok(avg(true) > avg(false) + 30);
    const fraud = payments.filter(p => p.fraud).length;
    assert.ok(Math.abs(fraud / SAMPLE.size - SAMPLE.fraudRate) < 0.015, "fraud rate close to the configured one");
  });
});

describe("threshold trade-off", () => {
  const settings: Thresholds[] = [
    { challenge: 0, decline: 0 },
    { challenge: 30, decline: 70 },
    { challenge: 50, decline: NEVER },
    { challenge: NEVER, decline: NEVER },
  ];

  it.each(settings)("counts every payment once (challenge ≥ $challenge, decline ≥ $decline)", t => {
    const o = outcome(payments, t);
    const sum = (r: Record<Decision, number>) => r.approve + r.challenge + r.decline;
    assert.equal(sum(o.genuine) + sum(o.fraud), payments.length);
    assert.equal(o.cost, Math.round((o.fraudLoss + o.lostProfit) * 100) / 100);
  });

  it("approving everything loses no sales and stops no fraud", () => {
    const o = outcome(payments, { challenge: NEVER, decline: NEVER });
    assert.equal(o.lostProfit, 0);
    assert.equal(o.approvalRate, 1);
    assert.equal(o.fraudStopped, 0);
  });

  it("declining everything stops all fraud at the cost of every sale", () => {
    const o = outcome(payments, { challenge: 0, decline: 0 });
    assert.equal(o.fraudLoss, 0);
    assert.equal(o.fraudStopped, 1);
    assert.equal(o.approvalRate, 0);
  });

  it("charges the merchant nothing for fraud that passes the challenge (liability shift)", () => {
    const o = outcome(payments, { challenge: 0, decline: NEVER });
    assert.equal(o.fraudLoss, 0);
    assert.ok(Math.abs(o.fraudStopped - CHALLENGE.stopsFraud) < 1e-9);
    assert.ok(Math.abs(o.approvalRate - (1 - CHALLENGE.genuineAbandon)) < 1e-9);
  });

  it("finds a setting at least as cheap as the common ones, and cheaper than both extremes", () => {
    const best = cheapest(payments);
    for (const t of settings) assert.ok(best.cost <= outcome(payments, t).cost, JSON.stringify(t));
    assert.ok(best.challenge <= best.decline);
    assert.ok(best.cost < outcome(payments, { challenge: NEVER, decline: NEVER }).cost);
  });
});
