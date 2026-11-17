import Simulator from "./components/Simulator";
import RepoData from "./components/RepoData";
import Terms from "./components/Terms";

export default function App() {
  return (
    <div className="wrap">
      <header style={{ display: "grid", gap: 10 }}>
        <span className="eyebrow">fintech basics · processing.excalidraw</span>
        <h1>Card Payment Lifecycle</h1>
        <p className="lede">
          Push one $210 card payment through authorization, capture, settlement and post-settlement. Watch which
          parties talk to each other, what status the transaction has, and where the money actually sits at each step.
        </p>
      </header>
      <Simulator />
      <RepoData />
      <Terms />
    </div>
  );
}
