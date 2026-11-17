import { useMemo, useState, type CSSProperties } from "react";
import { money } from "../shared/money";
import {
  ACTIVITY, DAYS, balancesOn, dayLabel, isBusinessDay, payoutStatus, simulate,
  type Balances, type Entry, type Payout, type PayoutStatus, type Settings,
} from "./model";

const BUCKETS: [keyof Balances, string, string, string][] = [
  ["pending", "Pending", "Captured, waiting for settlement (T+N)", "--idle"],
  ["reserve", "Reserve", "Held back as a cushion against refunds and disputes", "--hold"],
  ["available", "Available", "Settled; goes out in the next payout", "--accent"],
  ["inTransit", "In transit", "Payout sent by ACH, not yet in the bank", "--muted"],
  ["inBank", "In bank", "Arrived in the merchant's bank account", "--ok"],
];

const STATUS: Record<PayoutStatus, [string, string]> = {
  PENDING: ["--idle", "Created at the cut-off; amount is fixed, transfer not sent yet."],
  IN_TRANSIT: ["--hold", "Submitted to the bank network (ACH). Usually 1 business day."],
  PAID: ["--ok", "Deposited. If the bank rejects it (closed account, wrong number) it becomes FAILED and the money returns to the balance."],
};
const statusStyle = (s: PayoutStatus) => ({ "--c": `var(${STATUS[s][0]})`, "--cs": `var(${STATUS[s][0]}-soft)` }) as CSSProperties;

const TYPE_LABEL: Record<Entry["type"], string> = {
  charge: "charge", refund: "refund", chargeback: "chargeback", reserve_hold: "reserve held", reserve_release: "reserve released",
};

function Controls({ s, set }: { s: Settings; set: (s: Settings) => void }) {
  return (
    <div className="panel controls">
      <label htmlFor="delay">Settlement delay
        <select id="delay" value={s.delay} onChange={e => set({ ...s, delay: +e.target.value })}>
          <option value={1}>T+1</option><option value={2}>T+2 (typical)</option><option value={7}>T+7 (new account)</option>
        </select>
      </label>
      <label htmlFor="schedule">Payout schedule
        <select id="schedule" value={s.schedule} onChange={e => set({ ...s, schedule: e.target.value as Settings["schedule"] })}>
          <option value="daily">Daily (business days)</option><option value="weekly">Weekly (Fridays)</option>
        </select>
      </label>
      <label htmlFor="reserve">Rolling reserve
        <select id="reserve" value={s.reservePct} onChange={e => set({ ...s, reservePct: +e.target.value })}>
          <option value={0}>None</option><option value={0.1}>10% for 7 days</option><option value={0.25}>25% for 7 days (risky merchant)</option>
        </select>
      </label>
    </div>
  );
}

function Calendar({ day, setDay, payouts }: { day: number; setDay: (d: number) => void; payouts: Payout[] }) {
  return (
    <div className="cal" role="group" aria-label="Day">
      {Array.from({ length: DAYS }, (_, d) => {
        const sales = ACTIVITY.filter(a => a[0] === d).length;
        const created = payouts.find(p => p.created === d);
        const arrives = payouts.find(p => p.arrival === d);
        return (
          <button key={d} aria-pressed={d === day} className={"cal-day" + (isBusinessDay(d) ? "" : " weekend")} onClick={() => setDay(d)}>
            <span className="cal-date">{dayLabel(d)}</span>
            <span className="cal-marks">
              {sales > 0 && <i className="mk sale" title={`${sales} transaction(s)`}>{sales}</i>}
              {created && <i className="mk out" title={`Payout #${created.id} created`}>#{created.id}↗</i>}
              {arrives && <i className="mk in" title={`Payout #${arrives.id} arrives`}>#{arrives.id}✓</i>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Buckets({ b }: { b: Balances }) {
  const total = BUCKETS.reduce((a, [k]) => a + Math.max(0, b[k]), 0) || 1;
  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Where the merchant's net money is, end of day</div>
      <div className="stack" aria-hidden="true">
        {BUCKETS.map(([k, , , c]) => b[k] > 0 && <i key={k} style={{ flexGrow: b[k] / total, background: `var(${c})` }} />)}
      </div>
      <div className="buckets">
        {BUCKETS.map(([k, name, desc, c], i) => (
          <div key={k} className="bucket">
            <span className="eyebrow" style={{ color: `var(${c})` }}>{i > 0 ? "→ " : ""}{name}</span>
            <span className="big">{money(b[k])}</span>
            <small>{desc}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryRows({ list, showAvail }: { list: Entry[]; showAvail?: boolean }) {
  return (
    <table>
      <thead><tr><th>Entry</th><th>Type</th><th className="n">Gross</th><th className="n">Fee</th><th className="n">Net</th>{showAvail && <th>Available</th>}</tr></thead>
      <tbody>
        {list.map(e => (
          <tr key={e.id}>
            <td>{e.label}</td><td className="mono">{TYPE_LABEL[e.type]}</td>
            <td className="n">{e.gross ? money(e.gross) : "—"}</td><td className="n">{e.fee ? money(-e.fee) : "—"}</td>
            <td className="n">{money(e.net)}</td>{showAvail && <td className="mono">{dayLabel(e.availableOn)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Reconciliation({ p, entries }: { p: Payout; entries: Entry[] }) {
  const list = p.entryIds.map(id => entries[id]);
  const sum = (f: (e: Entry) => boolean, v: (e: Entry) => number) => list.filter(f).reduce((a, e) => a + v(e), 0);
  const lines: [string, number][] = [
    ["Gross charges", sum(e => e.type === "charge", e => e.gross)],
    ["Processing fees", -sum(e => e.type === "charge", e => e.fee)],
    ["Refunds", sum(e => e.type === "refund", e => e.net)],
    ["Chargebacks + dispute fees", sum(e => e.type === "chargeback", e => e.net)],
    ["Reserve held", sum(e => e.type === "reserve_hold", e => e.net)],
    ["Reserve released", sum(e => e.type === "reserve_release", e => e.net)],
  ].filter(([, v]) => Math.abs(v as number) > 0.004) as [string, number][];
  return (
    <div className="panel" style={{ display: "grid", gap: 14 }}>
      <div>
        <div className="eyebrow">Payout #{p.id} reconciliation</div>
        <p className="lede">Created {dayLabel(p.created)} at the cut-off, arrives {dayLabel(p.arrival)}. A payout is one bank transfer that bundles many balance entries, which is why it never matches a single sale.</p>
      </div>
      <div className="cols">
        <div className="ledger" style={{ alignContent: "start" }}>
          {lines.map(([k, v]) => <div key={k} className="row"><span>{k}</span><span>{money(v)}</span></div>)}
          <div className="row" style={{ fontWeight: 600 }}><span>Payout amount</span><span>{money(p.amount)}</span></div>
        </div>
        <div className="scroll"><EntryRows list={list} /></div>
      </div>
    </div>
  );
}

export default function Payouts() {
  const [settings, setSettings] = useState<Settings>({ delay: 2, schedule: "daily", reservePct: 0, reserveDays: 7 });
  const [day, setDay] = useState(4);
  const [picked, setPicked] = useState<number | null>(null);
  const { entries, payouts } = useMemo(() => simulate(settings), [settings]);
  const b = balancesOn(day, entries, payouts);
  const visible = payouts.filter(p => p.created <= day);
  const selected = payouts.find(p => p.id === picked && p.created <= day) ?? visible[visible.length - 1];
  const today = entries.filter(e => e.day === day && e.type !== "reserve_release");
  const freed = entries.filter(e => e.availableOn === day && e.day < day && e.type !== "reserve_hold");

  return (
    <>
      <section>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">after settlement</span>
          <h2>From sale to bank deposit</h2>
          <p className="lede">
            Settlement moves money from the card networks to the processor. A payout moves the merchant's share from
            the processor to the merchant's bank. In between, every sale passes through balance buckets. Change the
            settings, then step through two weeks of sales.
          </p>
        </div>
        <Controls s={settings} set={s => { setSettings(s); setPicked(null); }} />
        <Calendar day={day} setDay={setDay} payouts={payouts} />
        <Buckets b={b} />
      </section>

      <section className="cols">
        <div className="panel scroll" style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="eyebrow">{dayLabel(day)} · new balance entries</div>
          {today.length ? <EntryRows list={today} showAvail /> : <p className="lede">No sales or reversals today.</p>}
          {freed.length > 0 && (<>
            <div className="eyebrow">Became available today</div>
            <EntryRows list={freed} />
          </>)}
        </div>
        <div className="panel" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <div className="eyebrow">Payouts so far</div>
          {visible.length === 0 && <p className="lede">No payout yet. The first sales are still pending settlement.</p>}
          {visible.map(p => {
            const st = payoutStatus(p, day)!;
            return (
              <button key={p.id} className="payout" aria-pressed={p.id === selected?.id} onClick={() => setPicked(p.id)}>
                <span className="mono">#{p.id}</span>
                <span className="badge" style={statusStyle(st)}>{st}</span>
                <span className="note" style={{ margin: 0 }}>{dayLabel(p.created)} → {dayLabel(p.arrival)}</span>
                <span className="mono" style={{ marginLeft: "auto" }}>{money(p.amount)}</span>
              </button>
            );
          })}
          <div className="detail">
            {(Object.keys(STATUS) as PayoutStatus[]).map(s => (
              <p key={s} style={{ fontSize: 13 }}><span className="badge" style={statusStyle(s)}>{s}</span> {STATUS[s][1]}</p>
            ))}
          </div>
        </div>
      </section>

      {selected && <Reconciliation p={selected} entries={entries} />}

      <p className="note">
        Illustrative pricing: 2.9% + $0.30 per charge, $15 per dispute, refunds don't return the fee. Refunds and
        chargebacks are taken from the available balance; if it goes negative, payouts stop until new sales cover it.
      </p>
    </>
  );
}
