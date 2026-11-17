import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { BATCH, positions, signed, split, totals } from "./model";

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: ${a} vs ${b}`);

describe("settlement", () => {
  it.each(["icpp", "blended"] as const)("fee splits add up to the amount on %s pricing", pricing => {
    for (const t of BATCH) {
      const s = split(t, pricing);
      near(s.interchange + s.scheme + s.processor + s.merchant, signed(t), `tx ${t.id}`);
    }
    const tot = totals(BATCH, pricing);
    near(tot.interchange + tot.scheme + tot.processor + tot.merchant, tot.gross, "totals");
  });

  it("conserves money along the settlement chain", () => {
    const p = positions(BATCH);
    const icpp = totals(BATCH, "icpp");
    near(
      p.issuers.reduce((a, i) => a + i.pays, 0),
      icpp.gross - icpp.interchange,
      "issuers pay gross minus interchange",
    );
    near(p.acquirerReceives, icpp.gross - icpp.interchange - icpp.scheme, "acquirer receives after scheme fees");
    near(p.acquirerReceives, icpp.processor + icpp.merchant, "acquirer funds the merchant and keeps the markup");
    const blended = totals(BATCH, "blended");
    near(p.acquirerReceives, blended.processor + blended.merchant, "same bank flows under blended pricing");
  });

  it("nets many transactions into fewer bank transfers", () => {
    const p = positions(BATCH);
    assert.ok(p.issuers.length + p.networks.length < BATCH.length * 2);
  });
});
