import { ACTORS, type Hop } from "../lifecycle";

export default function Actors({ hop, note }: { hop: Hop | null; note?: string }) {
  const active = hop ? hop.route.split("→") : [];
  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Who is talking</div>
      <div className="actors">
        {ACTORS.map(([id, name, sub]) => (
          <div key={id} className={"actor" + (active.includes(id) ? " on" : "")}>
            {name}<small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="hop">
        <span className="route">{hop ? hop.route : "—"}</span>
        {hop
          ? <span>{hop.text}{note}</span>
          : <span className="lede">Pick an action below to send the first message.</span>}
      </div>
    </div>
  );
}
