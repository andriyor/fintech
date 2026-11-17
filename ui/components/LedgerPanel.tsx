import { LEDGER_ROWS, money, type Ledger } from "../lifecycle";

export default function LedgerPanel({ ledger, changed }: { ledger: Ledger; changed: (keyof Ledger)[] }) {
  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Where the money is</div>
      <div className="receipt">
        <div><span>order</span><span>200.00</span></div>
        <div><span>tip</span><span>10.00</span></div>
        <div className="tot"><span>transaction</span><span>210.00</span></div>
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
        chargeback fee $15.
      </p>
    </div>
  );
}
