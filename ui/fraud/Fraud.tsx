import { useMemo, useState, type CSSProperties } from "react";
import { money } from "../shared/money";
import {
  BASE,
  CHALLENGE,
  CHARGEBACK_FEE,
  DECISION_INFO,
  MARGIN,
  NEVER,
  PRESETS,
  SAMPLE,
  SIGNALS,
  STEP,
  cheapest,
  decide,
  outcome,
  sample,
  score,
  type Decision,
  type Thresholds,
} from "./model";

const DECISIONS: Decision[] = ["approve", "challenge", "decline"];
const toneOf = (d: Decision) =>
  ({ "--c": `var(${DECISION_INFO[d][0]})`, "--cs": `var(${DECISION_INFO[d][0]}-soft)` }) as CSSProperties;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const cut = (v: number) => (v >= NEVER ? "off" : `≥ ${v}`);
const PAYMENTS = sample();
const BEST = cheapest(PAYMENTS);

/** Approve / challenge / decline as coloured segments of the 0–100 score line. */
function Bands({ t, mark }: { t: Thresholds; mark?: number }) {
  const c = Math.min(t.challenge, 101),
    d = Math.min(t.decline, 101);
  return (
    <div className="relative flex h-3 overflow-hidden rounded-md [&>i]:transition-[width]" aria-hidden="true">
      <i className="bg-ok-soft" style={{ width: `${c}%` }} />
      <i className="bg-hold-soft" style={{ width: `${d - c}%` }} />
      <i className="flex-1 bg-bad-soft" />
      {mark !== undefined && (
        <b className="absolute inset-y-0 -ml-0.5 w-0.75 bg-fg transition-[left]" style={{ left: `${mark}%` }} />
      )}
    </div>
  );
}

function OnePayment({ t }: { t: Thresholds }) {
  const [on, setOn] = useState<string[]>(PRESETS[3][1]);
  const s = score(on);
  const d = decide(s.score, t);
  const toggle = (id: string) => setOn(xs => (xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]));
  return (
    <section className="sim">
      <div className="panel grid content-start gap-3">
        <div className="eyebrow">Signals on this payment</div>
        <div className="actions mt-0">
          {PRESETS.map(([name, ids]) => (
            <button
              key={name}
              className="act alt"
              aria-pressed={ids.length === on.length && ids.every(i => on.includes(i))}
              onClick={() => setOn(ids)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="evidence">
          {SIGNALS.map(x => (
            <label key={x.id} htmlFor={`sig-${x.id}`}>
              <input id={`sig-${x.id}`} type="checkbox" checked={on.includes(x.id)} onChange={() => toggle(x.id)} />
              <span className="flex-1">
                {x.label}
                <small className="note mt-0 block">{x.note}</small>
              </span>
              <span className="mono text-muted">+{x.points}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="panel grid content-start gap-3">
        <div className="eyebrow">Risk score</div>
        <div className="flex flex-wrap items-baseline gap-3.5">
          <span className="big">{s.score}</span>
          <span className="note mt-0">out of 100</span>
          <span className="badge" style={toneOf(d)}>
            {DECISION_INFO[d][1]}
          </span>
        </div>
        <Bands t={t} mark={s.score} />
        <p>{DECISION_INFO[d][2]}</p>
        <div className="ledger">
          <div className="row">
            <span>Base score</span>
            <span>{BASE}</span>
          </div>
          {s.parts.map(p => (
            <div key={p.id} className="row">
              <span>{p.label}</span>
              <span>+{p.points}</span>
            </div>
          ))}
        </div>
        <p className="note mt-0">
          Points follow how much likelier a signal is on fraud than on genuine payments, so weak signals (a new device)
          count little alone and add up when combined. Real systems learn this from data.
        </p>
      </div>
    </section>
  );
}

/** Genuine payments above the axis, fraud below, each half on its own scale; background shows the bands.
 *  The SVG works in score units and stretches to the width; labels are HTML so they stay readable. */
function Histogram({ t }: { t: Thresholds }) {
  const MAX = NEVER,
    H = 100; // x in score units 0–105, each half 100 units tall
  const counts = useMemo(() => {
    const g = new Array(MAX / STEP).fill(0),
      f = new Array(MAX / STEP).fill(0);
    for (const p of PAYMENTS) (p.fraud ? f : g)[Math.floor(p.score / STEP)]++;
    return { g, f, gMax: Math.max(...g), fMax: Math.max(...f) };
  }, []);
  const band = (from: number, to: number, c: string) =>
    to > from && <rect x={from} y={0} width={Math.min(to, MAX) - from} height={2 * H} fill={`var(${c})`} />;
  const bars = (ns: number[], max: number, cls: string, up: boolean) =>
    ns.map(
      (n, i) =>
        n > 0 && (
          <rect
            key={cls + i}
            x={i * STEP + 0.4}
            width={STEP - 0.8}
            y={up ? H - (n / max) * (H - 4) : H}
            height={(n / max) * (H - 4)}
            className={cls === "fraud" ? "fill-bad" : "fill-idle"}
          />
        ),
    );
  return (
    <div className="grid gap-1">
      <div className="font-mono text-[11px] text-muted">genuine · {PAYMENTS.filter(p => !p.fraud).length}</div>
      <svg
        viewBox={`0 0 ${MAX} ${2 * H}`}
        preserveAspectRatio="none"
        className="block h-50 w-full"
        role="img"
        aria-label={`Score distribution of ${PAYMENTS.length} payments: genuine above the axis, fraud below`}
      >
        {band(0, t.challenge, "--ok-soft")}
        {band(t.challenge, t.decline, "--hold-soft")}
        {band(t.decline, MAX, "--bad-soft")}
        {bars(counts.g, counts.gMax, "genuine", true)}
        {bars(counts.f, counts.fMax, "fraud", false)}
        <line x1={0} x2={MAX} y1={H} y2={H} className="stroke-muted" vectorEffect="non-scaling-stroke" />
        {[t.challenge, t.decline]
          .filter(v => v < NEVER)
          .map((v, i) => (
            <line
              key={i}
              x1={v}
              x2={v}
              y1={0}
              y2={2 * H}
              className="stroke-fg stroke-[1.5] [stroke-dasharray:4_3]"
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      <div className="font-mono text-[11px] text-muted">fraud · {PAYMENTS.filter(p => p.fraud).length}</div>
      <div className="relative h-4 font-mono text-[11px] text-muted" aria-hidden="true">
        {[0, 25, 50, 75, 100].map(v => (
          <span key={v} className={"absolute " + (v ? "-translate-x-1/2" : "")} style={{ left: `${(v / MAX) * 100}%` }}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tradeoff({ t, set }: { t: Thresholds; set: (t: Thresholds) => void }) {
  const o = outcome(PAYMENTS, t);
  const slider = (key: keyof Thresholds, label: string) => (
    <label htmlFor={`t-${key}`}>
      {label} <span className="mono">{cut(t[key])}</span>
      <input
        id={`t-${key}`}
        type="range"
        min={0}
        max={NEVER}
        step={STEP}
        value={t[key]}
        onChange={e => {
          const v = +e.target.value;
          // Keep challenge ≤ decline by moving the other line along.
          set(
            key === "challenge"
              ? { challenge: v, decline: Math.max(v, t.decline) }
              : { challenge: Math.min(v, t.challenge), decline: v },
          );
        }}
      />
    </label>
  );
  const isBest = t.challenge === BEST.challenge && t.decline === BEST.decline;
  return (
    <section>
      <div className="grid gap-1.5">
        <h2>Where to draw the lines</h2>
        <p className="lede">
          The same rules scored {PAYMENTS.length} past payments, {pct(SAMPLE.fraudRate)} of them fraud. Move the
          thresholds: catching more fraud means challenging or declining more genuine customers.
        </p>
      </div>
      <div className="panel grid gap-3.5">
        <div className="controls items-end">
          {slider("challenge", "Challenge with 3-D Secure")}
          {slider("decline", "Decline")}
          <button
            className="act alt"
            disabled={isBest}
            onClick={() => set({ challenge: BEST.challenge, decline: BEST.decline })}
          >
            {isBest
              ? "This is the cheapest setting"
              : `Use the cheapest: ${cut(BEST.challenge)} / ${cut(BEST.decline)}`}
          </button>
        </div>
        <Histogram t={t} />
        <p className="note mt-0">Each half has its own scale: fraud is rare, so its bars are magnified.</p>
      </div>
      <div className="sim">
        <div className="panel overflow-x-auto">
          <div className="eyebrow mb-2.5">What happens to each payment</div>
          <table>
            <thead>
              <tr>
                <th></th>
                {DECISIONS.map(d => (
                  <th key={d} className="n">
                    <span className="badge" style={toneOf(d)}>
                      {d}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Genuine</td>
                {DECISIONS.map(d => (
                  <td key={d} className="n">
                    {o.genuine[d]}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Fraud</td>
                {DECISIONS.map(d => (
                  <td key={d} className="n">
                    {o.fraud[d]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="note">
            A challenge stops {pct(CHALLENGE.stopsFraud)} of fraud and loses {pct(CHALLENGE.genuineAbandon)} of genuine
            customers, who give up. Fraud that passes it is the issuer's loss, not the merchant's.
          </p>
        </div>
        <div className="panel grid content-start gap-3">
          <div className="eyebrow">Cost of this setting</div>
          <div className="ledger">
            <div className="row">
              <span>Genuine sales completed</span>
              <span>{pct(o.approvalRate)}</span>
            </div>
            <div className="row">
              <span>Fraud stopped</span>
              <span>{pct(o.fraudStopped)}</span>
            </div>
            <div className="row">
              <span>Fraud chargebacks (merchant pays)</span>
              <span>{money(o.fraudLoss)}</span>
            </div>
            <div className="row">
              <span>Profit lost on genuine sales</span>
              <span>{money(o.lostProfit)}</span>
            </div>
            <div className="row font-semibold">
              <span>Total cost</span>
              <span>{money(o.cost)}</span>
            </div>
            <div className="row">
              <span>Cheapest possible</span>
              <span>{money(BEST.cost)}</span>
            </div>
          </div>
          <p className="note mt-0">
            A fraud chargeback costs the whole amount plus a {money(CHARGEBACK_FEE)} fee; a lost genuine sale costs the
            profit on it ({pct(MARGIN)} margin). That asymmetry is why the cheapest setting challenges a lot.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Fraud() {
  const [t, setT] = useState<Thresholds>({ challenge: 30, decline: 70 });
  return (
    <>
      <section>
        <div className="grid gap-1.5">
          <span className="eyebrow">before authorization</span>
          <h2>Scoring a payment for fraud</h2>
          <p className="lede">
            Before a payment goes to the issuer, the merchant or processor scores how risky it looks. Low scores go
            through, high ones are declined, and the middle is challenged with 3-D Secure. Pick the signals on one
            payment, then see what the thresholds cost across many.
          </p>
        </div>
      </section>
      <OnePayment t={t} />
      <Tradeoff t={t} set={setT} />
      <p className="note">
        Illustrative: additive points instead of a machine-learned model, independent signals, and a 3-D Secure
        challenge that stops {pct(CHALLENGE.stopsFraud)} of fraud. Real fraud rates are far lower than this sample's.
      </p>
    </>
  );
}
