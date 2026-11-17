import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { available, balances, equation, post, total, type Book, type EventKind } from "./model";

const paths: EventKind[][] = [
  ["sale", "sale", "refund", "settle", "payout"],
  ["sale", "payout", "settle"], // processor fronts the payout
  ["sale", "chargeback", "settle", "payout"], // negative balance is collected
  ["sale", "sale", "chargeback", "won", "refund", "payout", "settle", "sale", "chargeback", "payout"],
];
const BOOKS: Book[] = ["merchant", "processor"];

describe("double-entry ledger", () => {
  it.each(paths.map(p => [p.join(" → "), p] as const))("keeps the books balanced: %s", (_, path) => {
    for (let i = 1; i <= path.length; i++) {
      const events = path.slice(0, i);
      assert.equal(available(events.slice(0, -1))[events.at(-1)!], null, `${events.at(-1)} allowed after ${events.slice(0, -1)}`);
      const entries = post(events);
      for (const e of entries) for (const book of BOOKS)
        assert.equal(total(e.lines[book], "dr"), total(e.lines[book], "cr"), `entry ${e.n} balances in ${book} books`);
      const b = balances(entries);
      for (const book of BOOKS) {
        const q = equation(book, b);
        assert.equal(q.assets, q.liabilities + q.equity, `${book}: assets = liabilities + equity after ${events}`);
      }
      assert.equal(b.merchant.recv, b.processor.payable, "the merchant's receivable mirrors the processor's payable");
    }
  });

  it("leaves only real profit once everything is paid out and settled", () => {
    const b = balances(post(["sale", "settle", "payout"]));
    assert.equal(b.merchant.cash, 9_680);
    assert.equal(b.processor.cash, 130, "processor keeps its $1.30 margin");
    assert.equal(equation("processor", b).equity, 130);
  });

  it("disallows events that don't make sense yet", () => {
    assert.equal(available(["sale", "refund"]).refund, "No sale left to refund");
  });
});
