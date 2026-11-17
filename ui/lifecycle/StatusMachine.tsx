import { graphOf } from "../shared/graph";
import MachineDiagram from "../shared/MachineDiagram";
import { paymentMachine } from "./machine";
import { STATES, tone, type LifecycleStatus } from "./model";
import Badge from "./Badge";

const GRAPH = graphOf(paymentMachine);

type Props = {
  current: LifecycleStatus | null;
  history: LifecycleStatus[];
  actions: string[];
  label: (event: string) => string;
  hot: string[];
  onHot: (events: string[]) => void;
  peek: LifecycleStatus | null;
  onPeek: (s: LifecycleStatus) => void;
};

export default function StatusMachine({ current, history, actions, label, hot, onHot, peek, onPeek }: Props) {
  return <MachineDiagram graph={GRAPH} current={current} path={history} actions={actions} label={label} hot={hot} onHot={onHot} tone={tone} peek={peek} onPeek={k => onPeek(k as LifecycleStatus)} />;
}

/** What the current (or clicked) status means. */
export function StatusDetail({ current, peek }: { current: LifecycleStatus | null; peek: LifecycleStatus | null }) {
  const shown = peek ?? current;
  return (
    <div className="detail">
        {shown ? (
          <>
            <div>
              <Badge status={shown} />
              {peek && peek !== current && <span className="note"> (reading only — not the current status)</span>}
            </div>
            <p>{STATES[shown][1]}</p>
          </>
        ) : (
          <p className="lede">No payment yet. Choose a scenario, then pay.</p>
        )}
    </div>
  );
}
