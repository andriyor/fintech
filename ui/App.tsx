import { useEffect, useState } from "react";
import Simulator from "./components/Simulator";
import RepoData from "./components/RepoData";
import Terms from "./components/Terms";
import Payouts from "./components/Payouts";
import Chargebacks from "./components/Chargebacks";
import Settlement from "./components/Settlement";

const TABS = [
  ["lifecycle", "Payment lifecycle"],
  ["settlement", "Settlement"],
  ["payouts", "Payouts"],
  ["chargebacks", "Chargebacks"],
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
          {TABS.map(([id, name]) => (
            <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined}>{name}</a>
          ))}
        </nav>
      </header>
      {tab === "lifecycle" && (
        <>
          <section>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="eyebrow">from tap to merchant</span>
              <h2>The life of one card payment</h2>
              <p className="lede">
                Every card payment goes through authorization, capture, clearing and settlement, and may later be
                refunded or disputed. Pick a scenario, then step through it: watch which parties talk to each other,
                what status the payment has, and where the money sits at each step.
              </p>
            </div>
          </section>
          <Simulator />
          <Terms />
        </>
      )}
      {tab === "settlement" && <Settlement />}
      {tab === "payouts" && <Payouts />}
      {tab === "chargebacks" && <Chargebacks />}
      {tab === "repo" && <RepoData />}
    </div>
  );
}
