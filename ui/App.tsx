import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import Overview from "./overview/Overview";
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
import { GROUPS, JOURNEY, TAB_IDS, type Tab } from "./shared/tabs";

const fromHash = (): Tab => TAB_IDS.find(id => `#${id}` === location.hash) ?? "overview";

const LINK =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent no-underline rounded-md";

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const on = () => {
      setTab(fromHash());
      scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const step = JOURNEY.findIndex(([id]) => id === tab);
  const prev = step > 0 ? JOURNEY[step - 1] : step === 0 ? (["overview", "Overview"] as const) : null;
  const next = step >= 0 && step < JOURNEY.length - 1 ? JOURNEY[step + 1] : null;

  return (
    <div className="mx-auto grid max-w-[1360px] gap-8 pt-8 pr-[max(16px,env(safe-area-inset-right,0px))] pb-16 pl-[max(16px,env(safe-area-inset-left,0px))] lg:grid-cols-[210px_minmax(0,1fr)]">
      <header className="grid content-start gap-4 lg:sticky lg:top-8 lg:self-start">
        <div className="grid gap-1">
          <span className="eyebrow">fintech basics</span>
          <h1 className="text-[22px] leading-tight">How Card Payments Work</h1>
        </div>
        <nav className="flex gap-4 overflow-x-auto max-lg:-mx-4 max-lg:border-b max-lg:border-line max-lg:px-4 max-lg:pb-3 lg:grid lg:gap-5">
          {GROUPS.map(([group, tabs]) => (
            <div key={group} className="grid shrink-0 content-start gap-0.5">
              <span className="eyebrow mb-1 px-2.5 text-[11px]">{group}</span>
              <div className="flex gap-0.5 lg:grid">
                {tabs.map(([id, name]) => {
                  const Icon = TOPIC_ICONS[id];
                  const n = JOURNEY.findIndex(([j]) => j === id);
                  return (
                    <a
                      key={id}
                      href={`#${id}`}
                      aria-current={tab === id ? "page" : undefined}
                      className={`${LINK} inline-flex items-center gap-2 px-2.5 py-1.5 text-[14px] font-medium whitespace-nowrap text-muted hover:bg-surface hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent`}
                    >
                      {n >= 0 ? <span className="mono w-4 text-center text-[11px]">{n + 1}</span> : <Icon size={16} />}
                      {name}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <a
          href="https://github.com/andriyor/fintech"
          target="_blank"
          rel="noreferrer"
          className={`${LINK} inline-flex items-center gap-2 justify-self-start px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface hover:text-fg`}
        >
          {/* GitHub mark; lucide no longer ships brand icons */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Source on GitHub
          <ExternalLink size={12} aria-hidden />
        </a>
      </header>
      <main className="grid min-w-0 content-start gap-10">
        {tab === "overview" && <Overview />}
        {tab === "lifecycle" && <Lifecycle />}
        {tab === "tokens" && <Tokens />}
        {tab === "fraud" && <Fraud />}
        {tab === "settlement" && <Settlement />}
        {tab === "payouts" && <Payouts />}
        {tab === "chargebacks" && <Chargebacks />}
        {tab === "ledger" && <Ledger />}
        {tab === "terms" && <Terms />}
        {tab === "repo" && <RepoData />}
        {step >= 0 && (
          <nav aria-label="Journey" className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
            {prev && (
              <a href={`#${prev[0]}`} className={`${LINK} panel group grid gap-0.5 text-fg hover:border-accent`}>
                <span className="eyebrow inline-flex items-center gap-1">
                  <ArrowLeft size={12} aria-hidden /> previous
                </span>
                <strong className="font-semibold">{prev[1]}</strong>
              </a>
            )}
            {next && (
              <a
                href={`#${next[0]}`}
                className={`${LINK} panel group grid gap-0.5 text-right text-fg hover:border-accent sm:col-start-2`}
              >
                <span className="eyebrow inline-flex items-center justify-end gap-1">
                  next step {step + 2} <ArrowRight size={12} aria-hidden />
                </span>
                <strong className="font-semibold">{next[1]}</strong>
              </a>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
