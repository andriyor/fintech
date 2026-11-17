import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Graph } from "./graph";

type Props = {
  graph: Graph;
  current: string | null;              // state key, null before the machine leaves its start state
  path: string[];                      // states entered so far, in order
  actions: string[];                   // events the machine accepts now, in button order (badge n = button n)
  label: (event: string) => string;    // button text for an event
  hot: string[];                       // events being pointed at (a button, or every event on a hovered arrow)
  onHot: (events: string[]) => void;
  tone: (status: string) => CSSProperties;
  peek: string | null;
  onPeek: (key: string) => void;
};
type Box = { x: number; y: number; w: number; h: number };
const START = "\u0000start"; // key for the start dot, can't clash with a state name

// Point where the line from the box centre towards (tx, ty) leaves the box.
function exit(b: Box, tx: number, ty: number): [number, number] {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
  const t = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

// A gentle curve between two boxes; boxes stacked in one column bow out to the right so the arrow clears the boxes between them.
function curve(a: Box, b: Box): { d: string; mid: [number, number] } {
  const [ax, ay, bx, by] = [a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const sameColumn = Math.abs(bx - ax) < a.w / 2;
  // A quadratic curve peaks halfway to its control point, so bend by a full box width (+ margin) to pass beside the boxes.
  const bend = sameColumn ? (len > a.h * 2 ? a.w + 24 : 0) : len * 0.12;
  const cx = (ax + bx) / 2 + ((by - ay) / len) * bend * (sameColumn ? Math.sign(by - ay) || 1 : 1);
  const cy = (ay + by) / 2 - ((bx - ax) / len) * bend;
  const [sx, sy] = exit(a, cx, cy), [ex, ey] = exit(b, cx, cy);
  return { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, mid: [(sx + 2 * cx + ex) / 4, (sy + 2 * cy + ey) / 4] };
}

/** Status diagram drawn from a machine's graph: one column per phase, an arrow per transition. */
export default function MachineDiagram({ graph, current, path, actions, label, hot, onHot, tone, peek, onPeek }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});

  useLayoutEffect(() => {
    const el = wrap.current!;
    const measure = () => {
      const o = el.getBoundingClientRect();
      const next: Record<string, Box> = {};
      el.querySelectorAll<HTMLElement>("[data-key]").forEach(n => {
        const r = n.getBoundingClientRect();
        next[n.dataset.key!] = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
      });
      setBoxes(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.querySelectorAll("[data-key]").forEach(n => ro.observe(n));
    return () => ro.disconnect();
  }, [graph]);

  const taken = new Set(path.map((k, i) => `${i ? path[i - 1] : START}>${k}`));
  const edges = [{ from: START, to: graph.initial, events: [] as string[] }, ...graph.edges].flatMap(e => {
    const a = boxes[e.from], b = boxes[e.to];
    if (!a || !b) return [];
    const live = e.from === current ? actions.filter(x => e.events.includes(x)) : [];
    const cls = e.from === START ? (current === null ? "next" : "done")
      : live.length ? (live.some(x => hot.includes(x)) ? "next hot" : "next")
      : taken.has(`${e.from}>${e.to}`) ? "done" : "";
    return [{ ...e, ...curve(a, b), live, cls }];
  });
  const marker = (cls: string) => `url(#arrow-${cls.split(" ")[0] || "idle"})`;

  return (
    <div className="diagram" ref={wrap}>
      <svg aria-hidden="true">
        <defs>
          {["", "done", "next"].map(c => (
            <marker key={c} id={`arrow-${c || "idle"}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L10,5 L0,9 z" className={`head ${c}`} />
            </marker>
          ))}
        </defs>
        {edges.map(e => <path key={`${e.from}>${e.to}`} d={e.d} className={`edge ${e.cls}`} markerEnd={marker(e.cls)} />)}
      </svg>
      <div className="phases">
        {graph.phases.map(phase => (
          <div className="phase" key={phase}>
            <h3>{phase}</h3>
            {graph.nodes.some(n => n.key === graph.initial && n.phase === phase) && <i className="start-dot" data-key={START} title="start" />}
            {graph.nodes.filter(n => n.phase === phase).map(n => (
              <button
                key={n.key}
                data-key={n.key}
                style={tone(n.status)}
                aria-pressed={n.key === current}
                className={["state", n.final && "final", path.includes(n.key) && "visited", n.key === current && "current", n.key === peek && "peek"].filter(Boolean).join(" ")}
                onClick={() => onPeek(n.key)}
              >
                {n.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      {/* Above the boxes: a numbered badge per arrow that can happen now (same number as its button), a wide
          invisible stroke to hover it by, and the full label only for the arrow being pointed at. */}
      <svg className="labels" aria-hidden="true">
        {edges.filter(e => e.live.length).map(e => {
          const nums = e.live.map(x => actions.indexOf(x) + 1).join("·");
          const w = 8 + nums.length * 7;
          return (
            <g key={`${e.from}>${e.to}`} className={e.cls} onMouseEnter={() => onHot(e.live)} onMouseLeave={() => onHot([])}>
              <path d={e.d} className="hit" />
              <rect x={e.mid[0] - w / 2} y={e.mid[1] - 8} width={w} height={16} rx={8} className="badge-bg" />
              <text x={e.mid[0]} y={e.mid[1]} dy="0.35em" textAnchor="middle" className="badge-num">{nums}</text>
              {e.cls.includes("hot") && (
                <text x={e.mid[0]} y={e.mid[1] - 16} textAnchor="middle" className="edge-label">{e.live.map(label).join(" · ")}</text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="note legend">
        <span><i className="start-dot" /> start</span>
        <span><svg width="26" height="8" aria-hidden="true"><path d="M0,4 H26" className="edge next" /></svg> can happen now (numbered like the buttons)</span>
        <span><svg width="26" height="8" aria-hidden="true"><path d="M0,4 H26" className="edge done" /></svg> taken</span>
        <span><span className="state final" style={{ padding: "0 6px", cursor: "default" }}>&nbsp;</span> final</span>
      </p>
    </div>
  );
}
