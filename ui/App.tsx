import { useEffect, useState } from "react";
import Lifecycle from "./lifecycle/Lifecycle";
import Fraud from "./fraud/Fraud";
import Tokens from "./tokens/Tokens";
import Settlement from "./settlement/Settlement";
import Payouts from "./payouts/Payouts";
import Chargebacks from "./chargebacks/Chargebacks";
import Ledger from "./ledger/Ledger";
import RepoData from "./repo/RepoData";
import Terms from "./terms/Terms";
import { TOPIC_ICONS } from "./shared/icons";

const TABS = [
  ["lifecycle", "Payment lifecycle"],
  ["tokens", "Tokenization"],
  ["fraud", "Fraud & risk"],
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
    <div className="mx-auto grid max-w-[1120px] gap-10 pt-8 pr-[max(16px,env(safe-area-inset-right,0px))] pb-16 pl-[max(16px,env(safe-area-inset-left,0px))]">
      <header className="grid gap-2.5">
        <span className="eyebrow">fintech basics</span>
        <h1>How Card Payments Work</h1>
        <nav className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map(([id, name]) => {
            const Icon = TOPIC_ICONS[id];
            return (
              <a
                key={id}
                className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2 font-medium text-muted no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:border-accent aria-[current=page]:text-accent"
                href={`#${id}`}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={16} />
                {name}
              </a>
            );
          })}
        </nav>
      </header>
      {tab === "lifecycle" && <Lifecycle />}
      {tab === "tokens" && <Tokens />}
      {tab === "fraud" && <Fraud />}
      {tab === "settlement" && <Settlement />}
      {tab === "payouts" && <Payouts />}
      {tab === "chargebacks" && <Chargebacks />}
      {tab === "ledger" && <Ledger />}
      {tab === "terms" && <Terms />}
      {tab === "repo" && <RepoData />}
    </div>
  );
}
