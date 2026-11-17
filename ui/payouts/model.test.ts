import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DAYS, addBusinessDays, balancesOn, netOf, simulate } from "./model";

describe("payouts", () => {
  it("counts business days across weekends", () => {
    assert.equal(addBusinessDays(4, 1), 7, "Friday + 1 business day is Monday");
    assert.equal(addBusinessDays(5, 2), 8, "Saturday + 2 business days is Tuesday");
  });

  const settings = (["daily", "weekly"] as const).flatMap(schedule =>
    [0, 0.1].flatMap(reservePct => [1, 2, 7].map(delay => ({ delay, schedule, reservePct, reserveDays: 7 }))),
  );

  it.each(settings)("every dollar is in exactly one bucket ($schedule, T+$delay, reserve $reservePct)", s => {
    const { entries, payouts } = simulate(s);
    for (let d = 0; d < DAYS; d++) {
      const b = balancesOn(d, entries, payouts);
      const total = Math.round((b.pending + b.reserve + b.available + b.inTransit + b.inBank) * 100) / 100;
      assert.equal(total, netOf(entries, d), `day ${d}`);
    }
  });

  it.each(settings)("each payout reconciles to its entries ($schedule, T+$delay, reserve $reservePct)", s => {
    const { entries, payouts } = simulate(s);
    for (const p of payouts) {
      const sum = Math.round(p.entryIds.reduce((a, id) => a + entries[id].net, 0) * 100) / 100;
      assert.equal(sum, p.amount, `payout ${p.id}`);
      assert.ok(p.amount > 0);
    }
  });
});
