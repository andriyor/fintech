// Self-check for the payout simulation: `pnpm check` (Node strips the types).
import assert from "node:assert/strict";
import { DAYS, addBusinessDays, balancesOn, netOf, simulate } from "./payouts.ts";

assert.equal(addBusinessDays(4, 1), 7, "Friday + 1 business day is Monday");
assert.equal(addBusinessDays(5, 2), 8, "Saturday + 2 business days is Tuesday");

for (const schedule of ["daily", "weekly"] as const)
  for (const reservePct of [0, 0.1])
    for (const delay of [1, 2, 7]) {
      const { entries, payouts } = simulate({ delay, schedule, reservePct, reserveDays: 7 });
      for (let d = 0; d < DAYS; d++) {
        const b = balancesOn(d, entries, payouts);
        const total = Math.round((b.pending + b.reserve + b.available + b.inTransit + b.inBank) * 100) / 100;
        assert.equal(total, netOf(entries, d), `every dollar is in exactly one bucket (${schedule} T+${delay} r${reservePct} day ${d})`);
      }
      for (const p of payouts) {
        const sum = Math.round(p.entryIds.reduce((a, id) => a + entries[id].net, 0) * 100) / 100;
        assert.equal(sum, p.amount, `payout ${p.id} reconciles to its entries`);
        assert.ok(p.amount > 0);
      }
    }
console.log("payouts.check: ok");
