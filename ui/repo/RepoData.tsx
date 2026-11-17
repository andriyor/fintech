import { useState } from "react";
import type { Transaction } from "../../src/types";
import { aggregate } from "../../src/utils/single-pass";
import { money } from "../shared/money";
import Badge from "../lifecycle/Badge";
import Toggle from "../shared/Toggle";

// The real files, read at build time — edits to transactions/*.json show up on reload.
const files = import.meta.glob<Transaction>("../../transactions/*.json", { eager: true, import: "default" });
const TX = Object.entries(files).map(([path, tx]) => ({ file: path.split("/").pop()!, ...tx }));

// Captured/settled count, refunds/chargebacks subtract, everything else never moved money.
const SIGN: Record<string, number> = { CAPTURED: 1, SETTLED: 1, REFUNDED: -1, CHARGEBACK: -1 };
const maxT = Math.max(...TX.map(t => t.amounts.transaction));

function Rows({ obj }: { obj: Record<string, number> }) {
  return <>{Object.entries(obj).map(([k, v]) => (
    <div key={k} className="row"><span className="mono">{k}</span><span>{money(v)}</span></div>
  ))}</>;
}

function SumEverything() {
  const r = aggregate(TX) as { byStatus: Record<string, number>; bySource: Record<string, number>; totalTip: number };
  const sum = Object.values(r.byStatus).reduce((a, b) => a + b, 0);
  const captured = r.byStatus.CAPTURED ?? 0;
  return (
    <>
      <div><div className="eyebrow">sum of byStatus</div><div className="big">{money(sum)}</div></div>
      <div className="callout">
        This adds held, pending, voided and refunded orders together. Only the {money(captured)} captured order is
        actually the merchant's money.
      </div>
      <div><div className="eyebrow" style={{ marginBottom: 4 }}>byStatus</div><Rows obj={r.byStatus} /></div>
      <div><div className="eyebrow" style={{ marginBottom: 4 }}>bySource</div><Rows obj={r.bySource} /></div>
      <div className="row"><span>totalTip</span><span>{money(r.totalTip)}</span></div>
    </>
  );
}

function MoneyMoved() {
  const sales = TX.filter(t => SIGN[t.status] > 0);
  const reversals = TX.filter(t => SIGN[t.status] < 0);
  const gross = sales.reduce((a, t) => a + t.amounts.transaction, 0);
  const refunds = reversals.reduce((a, t) => a + t.amounts.transaction, 0);
  const fees = +(gross * 0.0215 + 0.1 * sales.length).toFixed(2);
  return (
    <>
      <div><div className="eyebrow">gross payments</div><div className="big">{money(gross)}</div></div>
      <div className="row"><span>− refunds</span><span>{money(-refunds)}</span></div>
      <div className="row"><span>− fees (illustrative 2.15% + $0.10)</span><span>{money(-fees)}</span></div>
      <div className="row" style={{ fontWeight: 600 }}><span>net payments</span><span>{money(gross - refunds - fees)}</span></div>
      <p className="note">
        Ignored: AUTHORIZED and PENDING (no money moved yet), VOIDED (hold released). A refund is assumed to reverse a
        sale captured in an earlier period, which is why net can go negative.
      </p>
    </>
  );
}

export default function RepoData() {
  const [mode, setMode] = useState<"all" | "real">("all");
  return (
    <section>
      <div style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow">src/utils/single-pass.ts on transactions/*.json</span>
        <h2>What the repo's aggregate counts</h2>
        <p className="lede">
          The sample files in <code className="mono">transactions/</code>. <code className="mono">aggregate()</code> sums{" "}
          <code className="mono">amounts.order</code> for every record regardless of status. Switch to “money that
          moved” to see gross and net as a merchant would report them.
        </p>
      </div>
      <div>
        <Toggle label="Counting mode" value={mode} set={setMode} options={[["all", "Sum every status"], ["real", "Money that moved"]]} />
      </div>
      <div className="cols">
        <div className="panel scroll">
          <table>
            <thead>
              <tr><th>File</th><th>Status</th><th>Source</th><th className="n">Order</th><th className="n">Tip</th><th>Split</th></tr>
            </thead>
            <tbody>
              {TX.map(t => (
                <tr key={t.file}>
                  <td className="mono">{t.file}</td>
                  <td><Badge status={t.status} /></td>
                  <td className="mono">{t.source}</td>
                  <td className="n">{t.amounts.order}</td>
                  <td className="n">{t.amounts.tip}</td>
                  <td>
                    <div className="bar" style={{ width: `${(t.amounts.transaction / maxT) * 100}%` }} title={`order ${t.amounts.order} + tip ${t.amounts.tip}`}>
                      <i style={{ width: `${(t.amounts.order / t.amounts.transaction) * 100}%`, background: "var(--accent)" }} />
                      <i style={{ flex: 1, background: "var(--hold)" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel" style={{ display: "grid", gap: 14 }}>
          {mode === "all" ? <SumEverything /> : <MoneyMoved />}
        </div>
      </div>
    </section>
  );
}
