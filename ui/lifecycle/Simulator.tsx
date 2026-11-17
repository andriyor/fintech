import { useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import type { Hop } from "../shared/parties";
import Actors from "../shared/Actors";
import { EVENTS, describe, paymentMachine, type UserEvent } from "./machine";
import type { Ledger, LifecycleStatus, Scenario } from "./model";
import StatusMachine, { StatusDetail } from "./StatusMachine";
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
  const [snap, send, actor] = useMachine(paymentMachine, { input: { amount: 100, channel: "present", mode: "auto" } });
  const { scenario, ledger, captured, history } = snap.context;
  const status = snap.value === "START" ? null : (snap.value as LifecycleStatus);
  const [changed, setChanged] = useState<(keyof Ledger)[]>([]);
  const [peek, setPeek] = useState<LifecycleStatus | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState<string[]>([]); // events whose button or arrow is pointed at
  const runId = useRef(0); // bumping it cancels an animation in flight

  // The machine decides which events are allowed here; the UI only renders them.
  const actions = EVENTS.filter(type => snap.can({ type })).map(type => ({ type, ...describe(type, snap.context) }));

  async function run(type: UserEvent["type"], hops: Hop[]) {
    const id = ++runId.current;
    setBusy(true);
    setPeek(null);
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 1100;
    for (const x of hops) {
      setHop(x);
      await sleep(delay);
      if (runId.current !== id) return;
    }
    const before = actor.getSnapshot().context.ledger;
    send({ type });
    const after = actor.getSnapshot().context.ledger;
    setChanged((Object.keys(after) as (keyof Ledger)[]).filter(k => after[k] !== before[k]));
    setBusy(false);
  }

  function reset() {
    runId.current++;
    send({ type: "RESET" });
    setChanged([]); setPeek(null); setHop(null); setBusy(false);
  }

  return (
    <section>
      <ScenarioControls sc={scenario} set={sc => send({ type: "SET_SCENARIO", scenario: sc })} locked={!!status || busy} />
      <Actors hop={hop} />
      <div className="panel">
        <div className="eyebrow">Status machine · click any status to read about it</div>
        <StatusMachine current={status} history={history} actions={actions.map(a => a.type)}
          label={e => describe(e as UserEvent["type"], snap.context).label} hot={busy ? [] : hot} onHot={setHot} peek={peek} onPeek={s => setPeek(p => (p === s ? null : s))} />
      </div>
      <div className="sim">
        <div className="panel">
          <StatusDetail current={status} peek={peek} />
          <div className="actions">
            {actions.map((a, i) => (
              <button key={a.type} className={"act" + (i ? " alt" : "") + (hot.includes(a.type) ? " hot" : "")} disabled={busy}
                onMouseEnter={() => setHot([a.type])} onMouseLeave={() => setHot([])} onFocus={() => setHot([a.type])} onBlur={() => setHot([])}
                onClick={() => { setHot([]); run(a.type, a.hops); }}><span className="num">{i + 1}</span>{a.label}</button>
            ))}
            {(status || busy) && <button className="act alt" onClick={reset}>Start over</button>}
          </div>
          {history.length > 0 && (
            <div className="path">path: {history.join(" → ")}{snap.hasTag("final") ? "  (final)" : ""}</div>
          )}
        </div>
        <LedgerPanel ledger={ledger} changed={changed} authorized={history.includes("AUTHORIZED") ? scenario.amount : 0} captured={captured} />
      </div>
    </section>
  );
}
