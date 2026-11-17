import { useState } from "react";
import { Building2, Database, Network, Server, Smartphone, Vault, type LucideIcon } from "lucide-react";
import Toggle from "../shared/Toggle";
import { APPROACHES, DATA, SYSTEMS, holdings, seenPan, type ApproachId, type Data, type SystemId } from "./model";

const ICONS: Record<SystemId, LucideIcon> = { device: Smartphone, server: Server, db: Database, processor: Vault, network: Network, issuer: Building2 };
const nameOf = (id: SystemId) => SYSTEMS.find(s => s.id === id)!.name;
const CHIP: Record<Data | "none", string> = {
  pan: "bg-bad-soft text-bad", token: "bg-ok-soft text-ok", networkToken: "bg-accent-soft text-accent", none: "bg-idle-soft text-idle",
};
const chip = (d: Data | "none") => `inline-block rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-snug font-semibold ${CHIP[d]}`;
const Chip = ({ data }: { data: Data }) => <span className={chip(data)}>{DATA[data].name}</span>;

function Flow({ id }: { id: ApproachId }) {
  const a = APPROACHES.find(x => x.id === id)!;
  const [step, setStep] = useState(0); // steps done; 0 = before the first
  const seen = seenPan(a, step), held = holdings(a, step);
  const cur = step ? a.steps[step - 1] : null;
  return (
    <>
      <div className="panel">
        <div className="eyebrow mb-2.5">Who holds what · red means it has seen the card number (PCI scope)</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {SYSTEMS.map(s => {
            const Icon = ICONS[s.id];
            const on = cur && (cur.from === s.id || cur.to === s.id);
            return (
              <div key={s.id} className={"grid min-w-0 content-start justify-items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center text-[13px] font-medium transition " + (seen.has(s.id) ? "border-bad ring-1 ring-inset ring-bad text-bad " : "border-line ") + (on ? "bg-accent-soft" : "")}>
                <Icon size={20} strokeWidth={1.75} className={seen.has(s.id) ? "text-bad" : "text-muted"} />
                <span className="text-fg">{s.name}<small className="block text-[11px] font-normal text-muted">{s.owner}</small></span>
                {held[s.id] ? <Chip data={held[s.id]!} /> : <span className={chip("none")}>nothing</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel grid gap-3">
        <div className="eyebrow">{step ? `Step ${step} of ${a.steps.length}` : "Before checkout"}</div>
        {cur ? (
          <div className="flex flex-wrap gap-2.5 items-baseline text-[14px]">
            <span className="font-mono text-[12px] font-medium text-accent whitespace-nowrap">{nameOf(cur.from)} → {nameOf(cur.to)}</span>
            <span>{cur.text} <Chip data={cur.data} /></span>
          </div>
        ) : <p className="lede">{a.summary}</p>}
        <div className="actions mt-0">
          <button className="act alt" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          <button className="act" disabled={step === a.steps.length} onClick={() => setStep(step + 1)}>
            {step === a.steps.length ? "Done" : step ? "Next step" : "Start checkout"}
          </button>
          {step === a.steps.length && <button className="act alt" onClick={() => setStep(0)}>Start over</button>}
        </div>
        {step === a.steps.length && (
          <p className="note mt-0">
            Saw the card number: {SYSTEMS.filter(s => seen.has(s.id)).map(s => s.name).join(", ")}.
          </p>
        )}
      </div>
    </>
  );
}

function Compare({ id }: { id: ApproachId }) {
  const rows: [string, (a: (typeof APPROACHES)[number]) => string][] = [
    ["Sees the card number", a => SYSTEMS.filter(s => seenPan(a).has(s.id)).map(s => s.name).join(", ")],
    ["Merchant's PCI work", a => a.pci],
    ["If the merchant database leaks", a => a.breach],
    ["When the card is reissued", a => a.reissue],
    ["Stored for next time", a => DATA[holdings(a).db!].name],
  ];
  return (
    <div className="panel overflow-x-auto">
      <table className="[&_td]:align-top [&_td]:min-w-44 [&_th]:align-top [&_[aria-current]]:bg-accent-soft">
        <thead><tr><th></th>{APPROACHES.map(a => <th key={a.id} aria-current={a.id === id || undefined}>{a.name}</th>)}</tr></thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}><th scope="row" className="font-sans text-[13px] normal-case tracking-normal text-fg whitespace-nowrap">{label}</th>{APPROACHES.map(a => <td key={a.id} aria-current={a.id === id || undefined}>{f(a)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Tokens() {
  const [id, setId] = useState<ApproachId>("direct");
  return (
    <>
      <section>
        <div className="grid gap-1.5">
          <span className="eyebrow">keeping card numbers out of reach</span>
          <h2>Tokenization and the card vault</h2>
          <p className="lede">
            Whoever sees a real card number must protect it under PCI DSS, and whoever stores it is what attackers go
            after. Tokens are stand-ins that are useless when stolen. Pick how the merchant takes cards, then step
            through a checkout and watch which systems ever see the number.
          </p>
        </div>
        <Toggle label="How the merchant takes cards" value={id} set={setId} options={APPROACHES.map(a => [a.id, a.name])} />
        {/* key resets the stepper when switching approach */}
        <Flow key={id} id={id} />
      </section>
      <section>
        <div className="grid gap-1.5">
          <h2>What the choice changes</h2>
          <p className="lede">The issuer and the card network always see the real number. What tokens change is everyone in between.</p>
        </div>
        <Compare id={id} />
        <div className="cols">
          {(Object.keys(DATA) as Data[]).map(d => (
            <div key={d} className="panel grid gap-1.5 content-start">
              <Chip data={d} />
              <span className="mono text-[13px]">{DATA[d].sample}</span>
              <span className="note mt-0">{DATA[d].note}</span>
            </div>
          ))}
        </div>
      </section>
      <p className="note">
        Simplified: one processor, card-on-file for the next purchase, and PCI self-assessment levels as typical
        examples (the exact SAQ depends on the integration). 4242 4242 4242 4242 is a public test card number.
      </p>
    </>
  );
}
