import { Building2, Cpu, Landmark, Network, Store, User } from "lucide-react";
import { ACTORS, type Hop } from "./parties";

const ICONS = { customer: User, merchant: Store, processor: Cpu, acquirer: Landmark, network: Network, issuer: Building2 };

export default function Actors({ hop, note }: { hop: Hop | null; note?: string }) {
  const active = hop ? hop.route.split("→") : [];
  return (
    <div className="panel">
      <div className="eyebrow mb-2.5">Who is talking</div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ACTORS.map(([id, name, sub]) => {
          const Icon = ICONS[id];
          return (
            <div key={id} className={"min-w-0 rounded-lg border px-2 py-2.5 text-center text-[13px] font-medium transition " + (active.includes(id) ? "bg-accent-soft border-accent -translate-y-0.5" : "border-line")}>
              <Icon size={20} strokeWidth={1.75} className={"block mx-auto mb-1 " + (active.includes(id) ? "text-accent" : "text-muted")} />{name}<small className="block text-[11px] font-normal text-muted">{sub}</small>
            </div>
          );
        })}
      </div>
      <div className="mt-3 min-h-12 text-[14px] flex max-md:flex-col gap-0.5 md:gap-2.5 items-baseline">
        <span className="font-mono text-[12px] font-medium text-accent whitespace-nowrap">{hop ? hop.route : "—"}</span>
        {hop
          ? <span>{hop.text}{note}</span>
          : <span className="lede">Pick an action below to send the first message.</span>}
      </div>
    </div>
  );
}
