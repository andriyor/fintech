import { LEDGER_ROWS, money, type Ledger } from "../lifecycle";

type Props = { ledger: Ledger; changed: (keyof Ledger)[]; authorized: number; captured: number };

export default function LedgerPanel({ ledger, changed, authorized, captured }: Props) {
  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Where the money is</div>
      <div className="receipt">
        <div><span>authorized</span><span>{authorized ? money(authorized) : "—"}</span></div>
        <div className="tot"><span>captured</span><span>{captured ? money(captured) : "—"}</span></div>
      </div>
      <div className="ledger">
        {LEDGER_ROWS.map(([key, name, sub]) => (
          <div key={key} className={"row" + (changed.includes(key) ? " flash" : "")}>
            <span className="k">{name}<small>{sub}</small></span>
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
