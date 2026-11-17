import { useRef, useState, type CSSProperties } from "react";
import { useMachine } from "@xstate/react";
import { money } from "../shared/money";
import type { Hop } from "../shared/parties";
import Actors from "../shared/Actors";
import { CARD_FEE, DISPUTE_FEE, ORDER, REASONS, STATUS_INFO, ratioBand, type DisputeStatus } from "./model";
import { EVENTS, LABELS, disputeMachine, hopsFor, wins, type UserEvent } from "./machine";
import { graphOf } from "../shared/graph";
import MachineDiagram from "../shared/MachineDiagram";

const GRAPH = graphOf(disputeMachine);
const statusOf = (key: string) => GRAPH.nodes.find(n => n.key === key)!.status as DisputeStatus;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const toneOf = (c: string) => ({ "--c": `var(${c})`, "--cs": `var(${c}-soft)` }) as CSSProperties;
const statusTone = (s: DisputeStatus) => toneOf(STATUS_INFO[s][0]);

function Dispute() {
  const [snap, send] = useMachine(disputeMachine);
  const { reasonId, evidence, entries: ledger, timeline: events } = snap.context;
  const status = events.at(-1)?.status ?? null;
  const node = events.at(-1)?.node ?? null; // machine state; WON_FINAL shows as WON
  const [hop, setHop] = useState<Hop | null>(null);
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState<string[]>([]); // events whose button or arrow is pointed at
  const [peek, setPeek] = useState<string | null>(null); // a machine state key
  const runId = useRef(0);

  const reason = REASONS.find(r => r.id === reasonId)!;
  const won = wins(snap.context);
  // The machine only accepts evidence changes while the merchant can respond: before the dispute and in each cycle.
  const evidenceLocked = !snap.can({ type: "TOGGLE_EVIDENCE", id: "" });
  const steps = EVENTS.filter(type => snap.can({ type }));

  async function run(type: UserEvent["type"]) {
    const id = ++runId.current;
    setBusy(true); setPeek(null);
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1100;
    for (const x of hopsFor(type, snap.context)) {
      setHop(x);
      await sleep(delay);
      if (runId.current !== id) return;
    }
    send({ type });
    setBusy(false);
  }

  function reset() {
    runId.current++;
    send({ type: "RESET" });
    setHop(null); setBusy(false); setPeek(null);
  }

  const total = ledger.reduce((a, e) => a + e.amount, 0);
  const shown = peek ?? node ? statusOf((peek ?? node)!) : null;
  const day = events.length ? events[events.length - 1].day : null;

  return (
    <section>
      <div className="panel controls items-end">
        <label htmlFor="reason">Dispute reason
          <select id="reason" value={reasonId} disabled={!!status || busy} onChange={e => send({ type: "SET_REASON", reasonId: e.target.value })}>
            {REASONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="grid gap-0.5 min-w-0">
          <span className="mono text-[12px] text-muted">{reason.code}</span>
          <span>{reason.story} Order: {money(ORDER)}, paid out to the merchant weeks ago.</span>
        </div>
      </div>

      <Actors hop={hop} />

      <div className="panel">
        <div className="eyebrow">Dispute status · click any status to read about it</div>
        <MachineDiagram graph={GRAPH} current={node} path={events.map(e => e.node)} tone={s => statusTone(s as DisputeStatus)}
          actions={[...steps]} label={e => LABELS[e as UserEvent["type"]]} hot={busy ? [] : hot} onHot={setHot} peek={peek} onPeek={k => setPeek(p => (p === k ? null : k))} />
      </div>

      <div className="sim">
        <div className="panel">
          <div className="detail">
            {shown
              ? <><div><span className="badge" style={statusTone(shown)}>{shown}</span>{peek && peek !== node && <span className="note"> (reading only — not the current status)</span>}</div><p>{STATUS_INFO[shown][1]}</p></>
              : <p className="lede">No dispute yet. Pick a reason, then let the customer dispute the charge.</p>}
          </div>
          <div className="actions">
            {steps.map((type, i) => (
              <button key={type} className={"act" + (i ? " alt" : "") + (hot.includes(type) ? " hot" : "")} disabled={busy}
                onMouseEnter={() => setHot([type])} onMouseLeave={() => setHot([])} onFocus={() => setHot([type])} onBlur={() => setHot([])}
                onClick={() => { setHot([]); run(type); }}><span className="num">{i + 1}</span>{LABELS[type]}</button>
            ))}
            {(status || busy) && <button className="act alt" onClick={reset}>Start over</button>}
          </div>
          {events.length > 0 && (
            <ol className="m-0 mt-3.5 grid list-none gap-1.5 p-0 text-[13px] [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:gap-2.5 [&_li>.mono:first-child]:min-w-13 [&_li>.mono:first-child]:text-muted">
              {events.map((e, i) => (
                <li key={i}><span className="mono">day {e.day}</span><span className="badge" style={statusTone(e.status)}>{e.status}</span><span>{e.label}</span></li>
              ))}
              {status === "NEEDS_RESPONSE" && <li className="text-hold"><span className="mono">day 7</span><span>Response deadline</span></li>}
              {snap.hasTag("final") && <li><span className="mono">final</span><span>Case closed{day !== null ? ` after ${day} days` : ""}.</span></li>}
            </ol>
          )}
        </div>

        <div className="grid gap-4 min-w-0">
          <div className="panel">
            <div className="eyebrow mb-2.5">Evidence to submit</div>
            <div className="evidence">
              {reason.evidence.map(e => (
                <label key={e.id} htmlFor={`ev-${e.id}`}>
                  <input id={`ev-${e.id}`} type="checkbox" checked={evidence.includes(e.id)} disabled={evidenceLocked || busy} onChange={() => send({ type: "TOGGLE_EVIDENCE", id: e.id })} />
                  {e.label}
                </label>
              ))}
            </div>
            <p className="note">
              Would win: <strong className={won ? "text-ok" : "text-bad"}>{won ? "yes" : "no"}</strong>. {reason.tip}
            </p>
          </div>

          <div className="panel">
            <div className="eyebrow mb-2.5">Merchant's money</div>
            <div className="ledger">
              {ledger.length === 0 && <p className="lede text-[14px]">Nothing taken yet.</p>}
              {ledger.map((e, i) => <div key={i} className="row"><span>{e.label}</span><span>{money(e.amount)}</span></div>)}
              <div className="row font-semibold"><span>Cost of this dispute</span><span>{money(total)}</span></div>
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
      <div className="grid gap-1.5">
        <h2>Chargeback ratio</h2>
        <p className="lede">
          Card networks track disputes ÷ transactions per month for every merchant. Won disputes still count. Above
          roughly 1%, the merchant enters a monitoring program.
        </p>
      </div>
      <div className="panel grid gap-3.5">
        <div className="controls">
          <label htmlFor="sales">Card transactions this month
            <input id="sales" type="number" min={0} value={sales} onChange={e => setSales(Math.max(0, +e.target.value))} />
          </label>
          <label htmlFor="disputes">Disputes this month
            <input id="disputes" type="number" min={0} value={disputes} onChange={e => setDisputes(Math.max(0, +e.target.value))} />
          </label>
        </div>
        <div className="relative mt-1 mb-5 h-3 rounded-md bg-idle-soft" aria-hidden="true">
          <i className="block h-full rounded-md transition-[width]" style={{ width: `${Math.min(ratio / 0.02, 1) * 100}%`, background: `var(${c})` }} />
          {[0.005, 0.009, 0.015].map(t => (
            <b key={t} className="absolute -inset-y-0.75 w-0.5 bg-muted" style={{ left: `${(t / 0.02) * 100}%` }}>
              <span className="absolute top-5 -left-3 font-mono text-[11px] font-normal text-muted">{(t * 100).toFixed(1)}%</span>
            </b>
          ))}
        </div>
        <div className="flex gap-3.5 items-baseline flex-wrap">
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
        <div className="grid gap-1.5">
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
