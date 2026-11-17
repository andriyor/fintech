// Landing tab: who takes part in a card payment, and the order to read the other tabs in.
import { ArrowRight } from "lucide-react";
import Actors from "../shared/Actors";
import { TOPIC_ICONS } from "../shared/icons";
import { JOURNEY } from "../shared/tabs";

export default function Overview() {
  return (
    <>
      <section>
        <div className="grid gap-1.5">
          <span className="eyebrow">overview</span>
          <h2>From tap to bank account</h2>
          <p className="lede">
            A card payment looks instant, but it is a chain of messages between six parties, followed days later by the
            money itself. Each tab simulates one part of that chain. Start with the lifecycle, or jump to any step.
          </p>
        </div>
        <Actors
          hop={{
            route: "customer→merchant→processor→acquirer→network→issuer",
            text: "An authorization request travels the whole chain, and the answer comes back the same way.",
          }}
        />
      </section>
      <section>
        <h2>The journey</h2>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map(([tab, title, text], i) => {
            const Icon = TOPIC_ICONS[tab];
            return (
              <li key={tab} className="contents">
                <a
                  href={`#${tab}`}
                  className="panel group grid content-start gap-1.5 text-fg no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <Icon size={18} className="text-accent" />
                    <strong className="font-semibold">{title}</strong>
                    <ArrowRight
                      size={14}
                      aria-hidden
                      className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </span>
                  <span className="text-[14px] text-muted">{text}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="note">
          New to the vocabulary? The <a href="#terms">Terms</a> tab explains every word used here.
        </p>
      </section>
    </>
  );
}
