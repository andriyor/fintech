import Simulator from "./Simulator";

export default function Lifecycle() {
  return (
    <>
      <section>
        <div className="grid gap-1.5">
          <span className="eyebrow">from tap to merchant</span>
          <h2>The life of one card payment</h2>
          <p className="lede">
            Every card payment goes through authorization, capture, clearing and settlement, and may later be refunded
            or disputed. Pick a scenario, then step through it: watch which parties talk to each other, what status the
            payment has, and where the money sits at each step.
          </p>
        </div>
      </section>
      <Simulator />
    </>
  );
}
