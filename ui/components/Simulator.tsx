import { useRef, useState } from "react";
import type { Source } from "../../src/types";
import { ACTIONS, START, type Hop, type Ledger, type LifecycleStatus } from "../lifecycle";
import Actors from "./Actors";
import StatusMachine from "./StatusMachine";
import LedgerPanel from "./LedgerPanel";

const SOURCES: Source[] = ["POS", "ECOMMERCE", "QR_CODE", "ACH"];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Simulator() {
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [ledger, setLedger] = useState<Ledger>(START);
  const [changed, setChanged] = useState<(keyof Ledger)[]>([]);
  const [history, setHistory] = useState<LifecycleStatus[]>([]);
  const [peek, setPeek] = useState<LifecycleStatus | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source>("POS");
  const runId = useRef(0); // bumping it cancels an animation in flight

  const actions = ACTIONS[status ?? "START"];

  async function run(i: number) {
    const id = ++runId.current;
    const { to, hops, apply } = actions[i];
    setBusy(true);
    setPeek(null);
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1100;
    for (const x of hops) {
      setHop(x);
      await sleep(delay);
      if (runId.current !== id) return;
    }
    const next = apply(ledger);
    setChanged((Object.keys(next) as (keyof Ledger)[]).filter(k => next[k] !== ledger[k]));
    setLedger(next);
    setStatus(to);
    setHistory(hs => [...hs, to]);
    setBusy(false);
  }

  function reset() {
    runId.current++;
    setStatus(null); setLedger(START); setChanged([]); setHistory([]); setPeek(null); setHop(null); setBusy(false);
  }

  const sourceNote = history.length === 0 && hop?.route === "customer→merchant" ? ` Source: ${source}.` : "";

  return (
    <section>
      <Actors hop={hop} note={sourceNote} />
      <div className="sim">
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div className="eyebrow">Status machine · click any status to read about it</div>
            <label className="src" htmlFor="source">
              Source
              <select id="source" value={source} disabled={!!status || busy} onChange={e => setSource(e.target.value as Source)}>
                {SOURCES.map(o => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <StatusMachine current={status} history={history} peek={peek} onPeek={s => setPeek(p => (p === s ? null : s))} />
          <div className="actions">
            {actions.map((a, i) => (
              <button key={a.label} className={"act" + (i ? " alt" : "")} disabled={busy} onClick={() => run(i)}>{a.label}</button>
            ))}
            {(status || busy) && <button className="act alt" onClick={reset}>Start over</button>}
          </div>
          {history.length > 0 && (
            <div className="path">path: {history.join(" → ")}{actions.length ? "" : "  (final)"}</div>
          )}
        </div>
        <LedgerPanel ledger={ledger} changed={changed} />
      </div>
    </section>
  );
}
