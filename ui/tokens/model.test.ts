import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { APPROACHES, DATA, SYSTEMS, holdings, merchantScope, seenPan } from "./model";

const byId = (id: string) => APPROACHES.find(a => a.id === id)!;
const ids = new Set(SYSTEMS.map(s => s.id));

describe("tokenization flows", () => {
  it.each(APPROACHES.map(a => [a.name, a] as const))("only uses known systems and data: %s", (_, a) => {
    for (const s of a.steps) {
      assert.ok(ids.has(s.from) && ids.has(s.to) && s.from !== s.to, JSON.stringify(s));
      assert.ok(s.data in DATA);
    }
  });

  it.each(APPROACHES.map(a => [a.name, a] as const))("ends with the issuer seeing the real card: %s", (_, a) => {
    assert.ok(seenPan(a).has("issuer"), "the issuer always authorizes the real card");
    assert.ok(seenPan(a).has("network"));
    assert.deepEqual(a.steps.at(-1)!.to, "issuer");
  });

  it("puts the merchant's server and database in PCI scope only when it handles the card", () => {
    assert.deepEqual(merchantScope(byId("direct")).sort(), ["db", "server"]);
    assert.deepEqual(merchantScope(byId("hosted")), []);
    assert.deepEqual(merchantScope(byId("network")), []);
  });

  it("keeps the card number out of the processor with network tokens", () => {
    assert.ok(seenPan(byId("hosted")).has("processor"), "a processor vault holds the real number");
    assert.ok(!seenPan(byId("network")).has("processor"));
  });

  it("stores a card number in the merchant database only in the direct approach", () => {
    assert.equal(holdings(byId("direct")).db, "pan");
    assert.equal(holdings(byId("hosted")).db, "token");
    assert.equal(holdings(byId("network")).db, "networkToken");
  });

  it("reveals exposure step by step, never taking it back", () => {
    for (const a of APPROACHES) {
      assert.equal(seenPan(a, 0).size, 0);
      for (let i = 1; i <= a.steps.length; i++)
        for (const s of seenPan(a, i - 1)) assert.ok(seenPan(a, i).has(s), `${a.id} step ${i}`);
    }
  });
});
