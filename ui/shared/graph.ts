// Reads the drawable graph out of an XState machine: top-level states (grouped by `meta.phase`) and the
// transitions between them. The diagram is drawn from this, so it can't drift from the rules.
import type { AnyStateMachine } from "xstate";

export type Meta = { phase?: string; label?: string; status?: string };
export type GraphNode = { key: string; phase: string; label: string; status: string; final: boolean };
// One arrow per pair of states; `events` lists every event that takes it ("always" for automatic ones).
export type GraphEdge = { from: string; to: string; events: string[] };
export type Graph = { initial: string; start: string; phases: string[]; nodes: GraphNode[]; edges: GraphEdge[] };

export function graphOf(machine: AnyStateMachine): Graph {
  const states = Object.values(machine.root.states);
  const start = machine.root.initial!.target[0].key;
  const nodes: GraphNode[] = states
    .filter(s => s.key !== start)
    .map(s => {
      const meta = (s.meta ?? {}) as Meta;
      return { key: s.key, phase: meta.phase ?? "", label: meta.label ?? s.key, status: meta.status ?? s.key, final: s.tags.includes("final") };
    });

  const edges = new Map<string, GraphEdge>();
  const add = (from: string, to: string, event: string) => {
    const e = edges.get(`${from}>${to}`) ?? { from, to, events: [] };
    if (!e.events.includes(event)) e.events.push(event);
    edges.set(`${from}>${to}`, e);
  };
  for (const s of states) {
    for (const [event, defs] of s.transitions) for (const d of defs) for (const t of d.target ?? []) add(s.key, t.key, event);
    for (const d of s.always ?? []) for (const t of d.target ?? []) add(s.key, t.key, "always");
  }

  // Phases in the order their first state is declared.
  const phases = [...new Set(nodes.map(n => n.phase))];
  const initial = [...edges.values()].find(e => e.from === start)!.to;
  return { initial, start, phases, nodes, edges: [...edges.values()].filter(e => e.from !== start) };
}
