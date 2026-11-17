import { PHASES, STATES, tone, type LifecycleStatus } from "./model";
import Badge from "./Badge";

type Props = {
  current: LifecycleStatus | null;
  history: LifecycleStatus[];
  peek: LifecycleStatus | null;
  onPeek: (s: LifecycleStatus) => void;
};

export default function StatusMachine({ current, history, peek, onPeek }: Props) {
  const shown = peek ?? current;
  return (
    <>
      <div className="phases" style={{ marginTop: 14 }}>
        {PHASES.map(([title, list]) => (
          <div className="phase" key={title}>
            <h3>{title}</h3>
            {list.map(s => (
              <button
                key={s}
                style={tone(s)}
                aria-pressed={s === current}
                className={["state", history.includes(s) && "visited", s === current && "current", s === peek && "peek"].filter(Boolean).join(" ")}
                onClick={() => onPeek(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ))}
      </div>
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
          <p className="lede">No transaction yet. Choose a source, then pay.</p>
        )}
      </div>
    </>
  );
}
