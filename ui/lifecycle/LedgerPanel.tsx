import { money } from "../shared/money";
import { LEDGER_ROWS, type Ledger } from "./model";

type Props = { ledger: Ledger; changed: (keyof Ledger)[]; authorized: number; captured: number };

export default function LedgerPanel({ ledger, changed, authorized, captured }: Props) {
  return (
    <div className="panel">
      <div className="eyebrow mb-2.5">Where the money is</div>
      <div className="mb-3 rounded-md border border-dashed border-line px-3 py-2.5 font-mono text-[13px] leading-relaxed [&>div]:flex [&>div]:justify-between">
        <div>
          <span>authorized</span>
          <span>{authorized ? money(authorized) : "—"}</span>
        </div>
        <div className="mt-1 border-t border-dashed border-line pt-1 font-semibold">
          <span>captured</span>
          <span>{captured ? money(captured) : "—"}</span>
        </div>
      </div>
      <div className="ledger">
        {LEDGER_ROWS.map(([key, name, sub]) => (
          <div key={key} className={"row" + (changed.includes(key) ? " [&>span:last-child]:text-accent" : "")}>
            <span>
              {name}
              <small className="block text-[12px] text-muted">{sub}</small>
            </span>
            <span>{money(ledger[key])}</span>
          </div>
        ))}
      </div>
      <p className="note">
        Fees are illustrative: interchange 1.5% to the issuer, scheme 0.15% to the network, processor 0.5% + $0.10,
        chargeback fee $15. The customer starts with $1,000 available.
      </p>
    </div>
  );
}
