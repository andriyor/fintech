import { useRef, useState, type CSSProperties } from "react";
import { money } from "../lifecycle";
import {
  CARD_FEE, DISPUTE_FEE, ORDER, PHASES, REASONS, STATUS_INFO, decide, ratioBand, stepsFrom,
  type DisputeStatus, type Entry, type Hop,
} from "../chargebacks";
import Actors from "./Actors";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const toneOf = (c: string) => ({ "--c": `var(${c})`, "--cs": `var(${c}-soft)` }) as CSSProperties;
const statusTone = (s: DisputeStatus) => toneOf(STATUS_INFO[s][0]);
type Event = { day: number; status: DisputeStatus; label: string };

function Dispute() {
  const [reasonId, setReasonId] = useState(REASONS[0].id);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [status, setStatus] = useState<DisputeStatus | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [hop, setHop] = useState<Hop | null>(null);
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState<DisputeStatus | null>(null);
  const runId = useRef(0);

  const reason = REASONS.find(r => r.id === reasonId)!;
  const won = decide(reason, evidence);
  const escalated = events.some(e => e.status === "PRE_ARBITRATION");
  const steps = stepsFrom(status, won, escalated);
  // The merchant can respond (and change evidence) in each cycle: first chargeback and pre-arbitration.
  const evidenceLocked = status !== null && status !== "NEEDS_RESPONSE" && status !== "PRE_ARBITRATION";

  async function run(i: number) {
    const id = ++runId.current;
    const step = steps[i];
    setBusy(true); setPeek(null);
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1100;
    for (const x of step.hops) {
      setHop(x);
      await sleep(delay);
      if (runId.current !== id) return;
    }
    const entries = typeof step.entries === "function" ? step.entries(won) : step.entries;
    setLedger(l => [...l, ...entries]);
    setEvents(ev => [...ev, { day: step.day, status: step.to, label: step.label }]);
    setStatus(step.to);
    setBusy(false);
  }

  function reset() {
    runId.current++;
    setStatus(null); setEvents([]); setLedger([]); setHop(null); setBusy(false); setPeek(null);
  }

  const toggle = (e: string) => setEvidence(ev => (ev.includes(e) ? ev.filter(x => x !== e) : [...ev, e]));
  const total = ledger.reduce((a, e) => a + e.amount, 0);
  const shown = peek ?? status;
  const day = events.length ? events[events.length - 1].day : null;

  return (
    <section>
      <div className="panel controls" style={{ alignItems: "end" }}>
        <label htmlFor="reason">Dispute reason
          <select id="reason" value={reasonId} disabled={!!status || busy} onChange={e => { setReasonId(e.target.value); setEvidence([]); }}>
            {REASONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{reason.code}</span>
          <span>{reason.story} Order: {money(ORDER)}, paid out to the merchant weeks ago.</span>
        </div>
      </div>

      <Actors hop={hop} />

      <div className="sim">
        <div className="panel">
          <div className="eyebrow">Dispute status · click any status to read about it</div>
          <div className="phases" style={{ marginTop: 14 }}>
            {PHASES.map(([title, list]) => (
              <div className="phase" key={title}>
                <h3>{title}</h3>
                {list.map(s => (
                  <button key={s} style={statusTone(s)} aria-pressed={s === status}
                    className={["state", events.some(e => e.status === s) && "visited", s === status && "current", s === peek && "peek"].filter(Boolean).join(" ")}
                    onClick={() => setPeek(p => (p === s ? null : s))}>{s}</button>
                ))}
              </div>
            ))}
          </div>
          <div className="detail">
            {shown
              ? <><div><span className="badge" style={statusTone(shown)}>{shown}</span>{peek && peek !== status && <span className="note"> (reading only — not the current status)</span>}</div><p>{STATUS_INFO[shown][1]}</p></>
              : <p className="lede">No dispute yet. Pick a reason, then let the customer dispute the charge.</p>}
          </div>
          <div className="actions">
            {steps.map((s, i) => (
              <button key={s.label} className={"act" + (i ? " alt" : "")} disabled={busy} onClick={() => run(i)}>{s.label}</button>
            ))}
            {(status || busy) && <button className="act alt" onClick={reset}>Start over</button>}
          </div>
          {events.length > 0 && (
            <ol className="timeline">
              {events.map((e, i) => (
                <li key={i}><span className="mono">day {e.day}</span><span className="badge" style={statusTone(e.status)}>{e.status}</span><span>{e.label}</span></li>
              ))}
              {status === "NEEDS_RESPONSE" && <li className="due"><span className="mono">day 7</span><span>Response deadline</span></li>}
              {steps.length === 0 && <li><span className="mono">final</span><span>Case closed{day !== null ? ` after ${day} days` : ""}.</span></li>}
            </ol>
          )}
        </div>

        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="panel">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Evidence to submit</div>
            <div className="evidence">
              {reason.evidence.map(e => (
                <label key={e.id} htmlFor={`ev-${e.id}`}>
                  <input id={`ev-${e.id}`} type="checkbox" checked={evidence.includes(e.id)} disabled={evidenceLocked || busy} onChange={() => toggle(e.id)} />
                  {e.label}
                </label>
              ))}
            </div>
            <p className="note">
              Would win: <strong style={{ color: won ? "var(--ok)" : "var(--bad)" }}>{won ? "yes" : "no"}</strong>. {reason.tip}
            </p>
          </div>

          <div className="panel">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Merchant's money</div>
            <div className="ledger">
              {ledger.length === 0 && <p className="lede" style={{ fontSize: 14 }}>Nothing taken yet.</p>}
              {ledger.map((e, i) => <div key={i} className="row"><span>{e.label}</span><span>{money(e.amount)}</span></div>)}
              <div className="row" style={{ fontWeight: 600 }}><span>Cost of this dispute</span><span>{money(total)}</span></div>
              <div className="row"><span>If the merchant had refunded instead</span><span>{money(-ORDER)}</span></div>
            </div>
            <p className="note">
              A refund also loses the original {money(CARD_FEE)} card fee, but there is no {money(DISPUTE_FEE)} dispute fee, no
              deadline, and it doesn't count toward the chargeback ratio. Fees are illustrative.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RatioCalculator() {
  const [sales, setSales] = useState(2000);
  const [disputes, setDisputes] = useState(12);
  const ratio = sales > 0 ? disputes / sales : 0;
  const [c, text] = ratioBand(ratio);
  return (
    <section>
      <div style={{ display: "grid", gap: 6 }}>
        <h2>Chargeback ratio</h2>
        <p className="lede">
          Card networks track disputes ÷ transactions per month for every merchant. Won disputes still count. Above
          roughly 1%, the merchant enters a monitoring program.
        </p>
      </div>
      <div className="panel" style={{ display: "grid", gap: 14 }}>
        <div className="controls">
          <label htmlFor="sales">Card transactions this month
            <input id="sales" type="number" min={0} value={sales} onChange={e => setSales(Math.max(0, +e.target.value))} />
          </label>
          <label htmlFor="disputes">Disputes this month
            <input id="disputes" type="number" min={0} value={disputes} onChange={e => setDisputes(Math.max(0, +e.target.value))} />
          </label>
        </div>
        <div className="gauge" aria-hidden="true">
          <i style={{ width: `${Math.min(ratio / 0.02, 1) * 100}%`, background: `var(${c})` }} />
          {[0.005, 0.009, 0.015].map(t => <b key={t} style={{ left: `${(t / 0.02) * 100}%` }}><span>{(t * 100).toFixed(1)}%</span></b>)}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="big" style={{ color: `var(${c})` }}>{(ratio * 100).toFixed(2)}%</span>
          <span>{text}</span>
        </div>
        <p className="note">Thresholds are approximate and differ per network and program; check your processor's numbers.</p>
      </div>
    </section>
  );
}

export default function Chargebacks() {
  return (
    <>
      <section>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">post-settlement</span>
          <h2>How a chargeback plays out</h2>
          <p className="lede">
            The cardholder disputes a charge with their bank. The money leaves the merchant's balance immediately, and
            the merchant has a few days to prove the charge was valid. Choose a reason and the evidence you have, then
            step through the case.
          </p>
        </div>
      </section>
      <Dispute />
      <RatioCalculator />
    </>
  );
}
