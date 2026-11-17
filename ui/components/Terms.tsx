const TERMS = [
  ["Payment processor", "The middleman that moves encrypted transaction data between merchant, acquiring bank, card network and issuer. Handles authorization requests, PCI DSS compliance, refunds, voids and chargebacks. Stripe, Adyen, Square, Fiserv."],
  ["Refund vs chargeback", "A refund is the merchant returning money voluntarily. A chargeback is the customer asking their issuing bank to reverse it by force, with an extra fee for the merchant. Refund first to avoid chargebacks."],
  ["Gross vs net", "Gross is the total collected before deductions. Net is what lands in the merchant account after interchange, scheme and processor fees."],
  ["Void vs refund", "A void cancels before capture, so only a hold is released and no money moves. A refund happens after settlement and sends money back."],
];

export default function Terms() {
  return (
    <section>
      <h2>Terms</h2>
      <dl className="panel">
        {TERMS.map(([term, def]) => (
          <div key={term}><dt>{term}</dt><dd>{def}</dd></div>
        ))}
      </dl>
    </section>
  );
}
