import { useEffect, useState } from "react";
import Simulator from "./components/Simulator";
import RepoData from "./components/RepoData";
import Terms from "./components/Terms";
import Payouts from "./components/Payouts";

const TABS = [
  ["lifecycle", "Payment lifecycle"],
  ["payouts", "Payouts"],
] as const;
type Tab = (typeof TABS)[number][0];

const fromHash = (): Tab => (location.hash === "#payouts" ? "payouts" : "lifecycle");

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
        <span className="eyebrow">fintech basics · processing.excalidraw</span>
        <h1>Card Payment Lifecycle</h1>
        <nav className="tabs">
          {TABS.map(([id, name]) => (
            <a key={id} href={`#${id}`} aria-current={tab === id ? "page" : undefined}>{name}</a>
          ))}
        </nav>
        {tab === "lifecycle" && (
          <p className="lede">
            Push one $210 card payment through authorization, capture, settlement and post-settlement. Watch which
            parties talk to each other, what status the transaction has, and where the money actually sits at each step.
          </p>
        )}
      </header>
      {tab === "lifecycle" ? (
        <>
          <Simulator />
          <RepoData />
          <Terms />
        </>
      ) : (
        <Payouts />
      )}
    </div>
  );
}
