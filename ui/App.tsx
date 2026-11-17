import { useEffect, useState } from "react";
import Lifecycle from "./lifecycle/Lifecycle";
import Settlement from "./settlement/Settlement";
import Payouts from "./payouts/Payouts";
import Chargebacks from "./chargebacks/Chargebacks";
import Ledger from "./ledger/Ledger";
import RepoData from "./repo/RepoData";
import Terms from "./terms/Terms";
import { TOPIC_ICONS } from "./shared/icons";

const TABS = [
  ["lifecycle", "Payment lifecycle"],
  ["settlement", "Settlement"],
  ["payouts", "Payouts"],
  ["chargebacks", "Chargebacks"],
  ["ledger", "Double-entry ledger"],
  ["terms", "Terms"],
  ["repo", "Repo data"],
] as const;
type Tab = (typeof TABS)[number][0];

const fromHash = (): Tab => TABS.find(([id]) => `#${id}` === location.hash)?.[0] ?? "lifecycle";

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const on = () => setTab(fromHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  return (
    <div className="wrap">
      <header style={{ display: "grid", gap: 10 }}>
        <span className="eyebrow">fintech basics</span>
        <h1>How Card Payments Work</h1>
        <nav className="tabs">
          {TABS.map(([id, name]) => {
            const Icon = TOPIC_ICONS[id];
            return <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined}><Icon size={16} />{name}</a>;
          })}
        </nav>
      </header>
      {tab === "lifecycle" && <Lifecycle />}
      {tab === "settlement" && <Settlement />}
      {tab === "payouts" && <Payouts />}
      {tab === "chargebacks" && <Chargebacks />}
      {tab === "ledger" && <Ledger />}
      {tab === "terms" && <Terms />}
      {tab === "repo" && <RepoData />}
    </div>
  );
}
