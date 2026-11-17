import { useRef, useState } from "react";
import { START, actionsFor, type Hop, type Ledger, type LifecycleStatus, type Scenario } from "../lifecycle";
import Actors from "./Actors";
import StatusMachine from "./StatusMachine";
import LedgerPanel from "./LedgerPanel";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function ScenarioControls({ sc, set, locked }: { sc: Scenario; set: (s: Scenario) => void; locked: boolean }) {
  return (
    <div className="panel controls" style={{ alignItems: "end" }}>
      <label htmlFor="channel">Where the card is used
        <select id="channel" value={sc.channel} disabled={locked} onChange={e => set({ ...sc, channel: e.target.value as Scenario["channel"] })}>
          <option value="present">In store (card present)</option>
          <option value="online">Online (card not present)</option>
        </select>
      </label>
      <label htmlFor="mode">Capture
        <select id="mode" value={sc.mode} disabled={locked} onChange={e => set({ ...sc, mode: e.target.value as Scenario["mode"] })}>
          <option value="auto">Automatic: capture with authorization</option>
          <option value="separate">Separate: authorize now, capture later</option>
        </select>
      </label>
      <label htmlFor="amount">Amount
        <input id="amount" type="number" min={1} step={1} value={sc.amount} disabled={locked}
          onChange={e => set({ ...sc, amount: Math.max(1, Math.min(990, Math.round(+e.target.value * 100) / 100 || 1)) })} />
      </label>
      <p className="note" style={{ margin: 0, maxWidth: "48ch" }}>
        {sc.mode === "auto"
          ? "Typical for a shop counter or a digital purchase: the sale is final the moment it's approved."
          : "Typical for hotels, car rentals and online stores that ship later: the merchant can capture less or void."}
      </p>
    </div>
  );
}

export default function Simulator() {
  const [scenario, setScenario] = useState<Scenario>({ amount: 100, channel: "present", mode: "auto" });
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  const [ledger, setLedger] = useState<Ledger>(START);
  const [captured, setCaptured] = useState(0);
  const [changed, setChanged] = useState<(keyof Ledger)[]>([]);
  const [history, setHistory] = useState<LifecycleStatus[]>([]);
  const [peek, setPeek] = useState<LifecycleStatus | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0); // bumping it cancels an animation in flight

  const actions = actionsFor(status ?? "START", scenario, captured);

  async function run(i: number) {
    const id = ++runId.current;
    const { to, via = [], hops, apply, captures } = actions[i];
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
    if (captures !== undefined) setCaptured(captures);
    setStatus(to);
    setHistory(hs => [...hs, ...via, to]);
    setBusy(false);
  }

  function reset() {
    runId.current++;
    setStatus(null); setLedger(START); setCaptured(0); setChanged([]); setHistory([]); setPeek(null); setHop(null); setBusy(false);
  }

  return (
    <section>
      <ScenarioControls sc={scenario} set={setScenario} locked={!!status || busy} />
      <Actors hop={hop} />
      <div className="sim">
        <div className="panel">
          <div className="eyebrow">Status machine · click any status to read about it</div>
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
        <LedgerPanel ledger={ledger} changed={changed} authorized={history.includes("AUTHORIZED") ? scenario.amount : 0} captured={captured} />
      </div>
    </section>
  );
}
