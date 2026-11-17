// Self-check for the double-entry model: `pnpm check`.
import assert from "node:assert/strict";
import { available, balances, equation, post, total, type Book, type EventKind } from "./model.ts";

const paths: EventKind[][] = [
  ["sale", "sale", "refund", "settle", "payout"],
  ["sale", "payout", "settle"], // processor fronts the payout
  ["sale", "chargeback", "settle", "payout"], // negative balance is collected
  ["sale", "sale", "chargeback", "won", "refund", "payout", "settle", "sale", "chargeback", "payout"],
];

for (const path of paths) {
  for (let i = 1; i <= path.length; i++) {
    const events = path.slice(0, i);
    assert.equal(available(events.slice(0, -1))[events.at(-1)!], null, `${events.at(-1)} allowed after ${events.slice(0, -1)}`);
    const entries = post(events);
    for (const e of entries) for (const book of ["merchant", "processor"] as Book[]) {
      assert.equal(total(e.lines[book], "dr"), total(e.lines[book], "cr"), `entry ${e.n} balances in ${book} books`);
    }
    const b = balances(entries);
    for (const book of ["merchant", "processor"] as Book[]) {
      const q = equation(book, b);
      assert.equal(q.assets, q.liabilities + q.equity, `${book}: assets = liabilities + equity after ${events}`);
    }
    assert.equal(b.merchant.recv, b.processor.payable, "the merchant's receivable mirrors the processor's payable");
  }
}

// After paying out and settling everything, only real profit is left.
const b = balances(post(["sale", "settle", "payout"]));
assert.equal(b.merchant.cash, 9_680);
assert.equal(b.processor.cash, 130, "processor keeps its $1.30 margin");
assert.equal(equation("processor", b).equity, 130);
assert.equal(available(["sale", "refund"]).refund, "No sale left to refund");
console.log("books.check: ok");
