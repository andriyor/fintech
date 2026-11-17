import { useState, type CSSProperties } from "react";
import { money } from "../shared/money";
import {
  BATCH, INTERCHANGE, STAGES, interchangeOf, positions, signed, split, totals,
  type Pricing, type Split, type Tx,
} from "./model";
import Actors from "../shared/Actors";
import Toggle from "../shared/Toggle";

const PARTS: [keyof Split, string, string][] = [
  ["interchange", "Issuer (interchange)", "--hold"],
  ["scheme", "Card network (scheme fee)", "--idle"],
  ["processor", "Acquirer / processor", "--accent"],
  ["merchant", "Merchant", "--ok"],
];
const STATUS = ["CAPTURED", "IN BATCH", "CLEARED", "SETTLED", "FUNDED"];
const STATUS_TONE = ["--idle", "--accent", "--hold", "--ok", "--ok"];
const toneOf = (c: string) => ({ "--c": `var(${c})`, "--cs": `var(${c}-soft)` }) as CSSProperties;
const pct = (v: number, of: number) => (of ? `${((v / of) * 100).toFixed(2)}%` : "—");

function Stages({ stage, setStage }: { stage: number; setStage: (n: number) => void }) {
  const s = STAGES[stage];
  return (
    <div className="panel" style={{ display: "grid", gap: 14 }}>
      <ol className="stages">
        {STAGES.map((x, i) => (
          <li key={x.name}>
            <button aria-pressed={i === stage} className={i < stage ? "done" : ""} onClick={() => setStage(i)}>
              <span className="mono">{x.when}</span>{x.name}
            </button>
          </li>
        ))}
      </ol>
      <p>{s.text}</p>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="act alt" disabled={stage === 0} onClick={() => setStage(stage - 1)}>Back</button>
        <button className="act" disabled={stage === STAGES.length - 1} onClick={() => setStage(stage + 1)}>
          {stage < STAGES.length - 1 ? `Next: ${STAGES[stage + 1].name}` : "Done"}
        </button>
      </div>
    </div>
  );
}

function BatchTable({ stage, selected, select }: { stage: number; selected: number; select: (id: number) => void }) {
  const cleared = stage >= 2;
  return (
    <div className="panel scroll">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Today's batch · click a row to see its fee split</div>
      <table className="pick">
        <thead><tr><th>Time</th><th>Card</th><th>Issuer</th><th className="n">Amount</th><th className="n">Interchange</th><th>Status</th></tr></thead>
        <tbody>
          {BATCH.map(t => (
            <tr key={t.id} aria-selected={t.id === selected} tabIndex={0} onClick={() => select(t.id)} onKeyDown={e => e.key === "Enter" && select(t.id)}>
              <td className="mono">{t.time}</td>
              <td>{t.brand} {t.card}{t.refund && <span className="badge" style={{ ...toneOf("--bad"), marginLeft: 6 }}>REFUND</span>}</td>
              <td>{t.issuer}</td>
              <td className="n">{money(signed(t))}</td>
              <td className="n">{cleared ? money(t.refund ? -interchangeOf(t) : interchangeOf(t)) : <span className="note">at clearing</span>}</td>
              <td><span className="badge" style={toneOf(STATUS_TONE[stage])}>{STATUS[stage]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SplitBar({ s, total }: { s: Split; total: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {PARTS.map(([k, , c]) => s[k] > 0 && <i key={k} style={{ flexGrow: s[k] / total, background: `var(${c})` }} />)}
    </div>
  );
}

function FeeSplit({ tx, pricing, setPricing }: { tx: Tx; pricing: Pricing; setPricing: (p: Pricing) => void }) {
  const s = split(tx, pricing);
  const other = split(tx, pricing === "icpp" ? "blended" : "icpp");
  const amount = Math.abs(signed(tx));
  const fees = amount - Math.abs(s.merchant);
  return (
    <div className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div className="eyebrow">Where {money(signed(tx))} goes</div>
      <Toggle label="Pricing" value={pricing} set={setPricing} options={[["icpp", "Interchange++"], ["blended", "Blended 2.9% + 30¢"]]} />
      {!tx.refund && <SplitBar s={s} total={amount} />}
      <div className="ledger">
        {PARTS.map(([k, name, c]) => (
          <div key={k} className="row">
            <span><i className="dot" style={{ background: `var(${c})` }} />{name}</span>
            <span>{money(s[k])}</span>
          </div>
        ))}
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        {tx.refund
          ? pricing === "icpp"
            ? "Refund: the issuer returns the interchange and interchange++ passes it back to the merchant."
            : "Refund: the issuer returns the interchange, but on blended pricing the processor keeps it. The merchant pays the full amount back."
          : <>
              {tx.brand} {tx.card}: {INTERCHANGE[tx.card][2]}. Interchange {pct(s.interchange, amount)}, merchant pays{" "}
              {pct(fees, amount)} in total. On {pricing === "icpp" ? "blended" : "interchange++"} pricing the merchant
              would get {money(other.merchant)} instead.
              {pricing === "blended" && s.processor < 0.5 && " The processor earns little or nothing on this card: blended pricing is priced for the average card, so expensive cards are subsidised by cheap ones."}
            </>}
      </p>
    </div>
  );
}

function Netting({ stage }: { stage: number }) {
  const p = positions(BATCH);
  const transfers = p.issuers.length + p.networks.length;
  if (stage < 3) {
    return (
      <div className="panel">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Net settlement</div>
        <p className="lede">Appears at the settlement stage. Until then, records have moved but money hasn't.</p>
      </div>
    );
  }
  return (
    <div className="panel scroll" style={{ display: "grid", gap: 12 }}>
      <div className="eyebrow">Net settlement · {BATCH.length} card transactions settle in {transfers} bank transfers</div>
      <table>
        <thead><tr><th>From</th><th>To</th><th className="n">Sales</th><th className="n">Net sales</th><th className="n">Kept</th><th className="n">Transfer</th></tr></thead>
        <tbody>
          {p.issuers.map(i => (
            <tr key={i.brand + i.issuer}>
              <td>{i.issuer}</td><td>{i.brand}</td><td className="n">{i.count}</td><td className="n">{money(i.gross)}</td>
              <td className="n" title="interchange">{money(i.interchange)}</td><td className="n">{money(i.pays)}</td>
            </tr>
          ))}
          {p.networks.map(n => (
            <tr key={n.brand} className="sum">
              <td>{n.brand}</td><td>Acquiring bank</td><td className="n"></td><td className="n">{money(n.received)}</td>
              <td className="n" title="scheme fee">{money(n.scheme)}</td><td className="n">{money(n.paysAcquirer)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note" style={{ marginTop: 0 }}>
        Each issuer keeps its interchange and sends one net amount per network; a refund in the same batch just lowers
        that amount. Each network keeps its scheme fee and sends one amount to the acquiring bank:{" "}
        <strong>{money(p.acquirerReceives)}</strong> in total. In reality each of those transfers also covers every
        other merchant and acquirer on the network that day, so millions of sales settle in a few hundred transfers.
      </p>
    </div>
  );
}

function Funding({ stage, pricing }: { stage: number; pricing: Pricing }) {
  const [mode, setMode] = useState<"net" | "gross">("net");
  const t = totals(BATCH, pricing);
  const fees = Math.round((t.gross - t.merchant) * 100) / 100;
  const p = positions(BATCH);
  return (
    <div className="panel" style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div className="eyebrow">Batch totals and funding</div>
      <div className="ledger">
        <div className="row"><span>Net sales (gross − refund)</span><span>{money(t.gross)}</span></div>
        {PARTS.slice(0, 3).map(([k, name]) => <div key={k} className="row"><span>− {name}</span><span>{money(-t[k])}</span></div>)}
        <div className="row" style={{ fontWeight: 600 }}><span>Merchant's share</span><span>{money(t.merchant)}</span></div>
        <div className="row"><span>Effective rate (fees ÷ net sales)</span><span>{pct(fees, t.gross)}</span></div>
      </div>
      {stage < 4 ? (
        <p className="lede" style={{ fontSize: 14 }}>Funding happens at the last stage.</p>
      ) : (
        <>
          <Toggle label="Funding mode" value={mode} set={setMode} options={[["net", "Net (fees deducted daily)"], ["gross", "Gross (fees billed monthly)"]]} />
          <div className="ledger">
            <div className="row" style={{ fontWeight: 600 }}><span>Deposit to merchant's bank today</span><span>{money(mode === "net" ? t.merchant : t.gross)}</span></div>
            {mode === "gross" && <div className="row"><span>Added to the monthly fee invoice</span><span>{money(-fees)}</span></div>}
            <div className="row"><span>Acquirer received from networks</span><span>{money(p.acquirerReceives)}</span></div>
            <div className="row"><span>Acquirer / processor keeps</span><span>{money(mode === "net" ? p.acquirerReceives - t.merchant : p.acquirerReceives - t.gross)}</span></div>
          </div>
          <p className="note" style={{ marginTop: 0 }}>
            {mode === "net"
              ? "Net funding: the deposit already has every fee taken out, so it reconciles to sales only through a fee report."
              : "Gross funding: the deposit equals net sales, which is easy to reconcile. The processor fronts the fees (it has paid out more than it received) and collects them with a monthly invoice."}
          </p>
        </>
      )}
    </div>
  );
}

export default function Settlement() {
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState(2);
  const [pricing, setPricing] = useState<Pricing>("icpp");
  const tx = BATCH.find(t => t.id === selected)!;
  const s = STAGES[stage];
  return (
    <>
      <section>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">after capture, before payout</span>
          <h2>Clearing and settlement of one day's batch</h2>
          <p className="lede">
            Authorization only reserves money. After the day closes, two separate things happen. Clearing exchanges the
            transaction records and fixes who owes what. Settlement moves the money between banks, netted per bank.
            Step through one merchant's day of {BATCH.length} card transactions.
          </p>
        </div>
        <Actors hop={{ route: s.route, text: `${s.name} · ${s.when}` }} />
        <Stages stage={stage} setStage={setStage} />
      </section>
      <section className="sim">
        <BatchTable stage={stage} selected={selected} select={setSelected} />
        <FeeSplit tx={tx} pricing={pricing} setPricing={setPricing} />
      </section>
      <section className="sim">
        <Netting stage={stage} />
        <Funding stage={stage} pricing={pricing} />
      </section>
      <p className="note">
        Illustrative rates: interchange from 0.05% + 21¢ (regulated debit) to 2.5% + 10¢ (commercial), scheme fee
        ~0.13–0.14%, interchange++ markup 0.2% + 10¢, blended 2.9% + 30¢. One acquirer, no currency conversion.
      </p>
    </>
  );
}
