// Glossary for every tab. Each group links to the tab that simulates it.
import { TOPIC_ICONS } from "../shared/icons";

// [title, icon topic, tab to link, terms]
const GROUPS: [string, string, string, [string, string][]][] = [
  ["Who is involved", "parties", "lifecycle", [
    ["Cardholder", "The customer paying with a card issued by their bank."],
    ["Issuer (issuing bank)", "The cardholder's bank. Approves or declines, holds and posts the charge, and handles disputes on the cardholder's side."],
    ["Acquirer (acquiring bank)", "The merchant's bank for card payments. Receives the money from the card network and funds the merchant."],
    ["Card network (scheme)", "Visa, Mastercard and others. Routes messages between acquirer and issuer, sets the rules and settles between banks."],
    ["Payment processor", "Moves encrypted transaction data between merchant, acquirer, network and issuer, and handles PCI DSS compliance, refunds, voids and chargebacks. Stripe, Adyen, Square, Fiserv."],
  ]],
  ["A payment's life", "lifecycle", "lifecycle", [
    ["Authorization", "The issuer checks the card, balance and fraud rules, then approves and places a hold. No money moves yet."],
    ["Hold", "Authorized money the cardholder can't spend, still in their account. It is released if the sale is voided or expires."],
    ["Capture", "The merchant confirms the sale, for the full amount or less. Automatic capture does it together with authorization; separate capture comes later (hotels, shipped orders)."],
    ["Void vs refund", "A void cancels before capture, so only a hold is released and no money moves. A refund happens after settlement and sends money back."],
    ["3-D Secure", "An extra check by the issuer for online payments, such as confirming in the bank's app. It shifts fraud liability from the merchant to the issuer."],
  ]],
  ["Clearing, settlement and fees", "settlement", "settlement", [
    ["Batch", "The day's captured sales, sent together at cut-off."],
    ["Clearing vs settlement", "Clearing is the exchange of transaction records after the batch closes: the issuer learns the final amount and posts the charge. Settlement is the money moving between banks afterwards, netted per bank."],
    ["Interchange", "The fee the issuer keeps on every sale. Set by the network; higher for credit, rewards and commercial cards, lowest for regulated debit."],
    ["Scheme fee", "The card network's own fee, a fraction of interchange."],
    ["Interchange++ vs blended", "Interchange++ passes interchange and scheme fees through at cost plus a fixed markup. Blended charges one flat rate (e.g. 2.9% + 30¢) whatever the card costs."],
    ["Gross vs net", "Gross is the total collected before deductions. Net is what lands in the merchant account after interchange, scheme and processor fees."],
  ]],
  ["Payouts", "payouts", "payouts", [
    ["Payout", "The processor's transfer of the merchant's available balance to their bank account."],
    ["T+N", "Payout delay in business days after the sale (T+2: two business days later). Weekends and holidays don't count."],
    ["Rolling reserve", "A share of each day's sales the processor holds back for a period (e.g. 10% for 90 days) to cover future refunds and chargebacks."],
    ["Reconciliation", "Matching each bank deposit to the sales, refunds and fees it is made of."],
  ]],
  ["Disputes", "chargebacks", "chargebacks", [
    ["Refund vs chargeback", "A refund is the merchant returning money voluntarily. A chargeback is the customer asking their issuing bank to reverse it by force, with an extra fee for the merchant. Refund first to avoid chargebacks."],
    ["Reason code", "The network's code for why a chargeback was filed (fraud, not received, not as described…). It decides what evidence can win."],
    ["Representment", "The merchant's response to a chargeback: evidence sent back through the acquirer to the issuer."],
    ["Pre-arbitration and arbitration", "If the issuer rejects the representment it can file again (pre-arbitration). If the merchant still disputes it, the network rules (arbitration), and the loser pays a large fee."],
    ["Chargeback ratio", "Disputes ÷ transactions per month. Above roughly 1% networks put the merchant in monitoring programs with fines."],
  ]],
  ["Bookkeeping", "ledger", "ledger", [
    ["Double-entry", "Every movement is written as at least one debit and one credit of the same total, so money can't appear or disappear."],
    ["Debit and credit", "Left and right side of an account. Assets and expenses grow with debits; liabilities and revenue grow with credits."],
    ["Merchant balance", "The money a processor holds for a merchant. An asset in the merchant's books and a liability in the processor's."],
  ]],
];

export default function Terms() {
  return (
    <>
      <section>
        <div style={{ display: "grid", gap: 6 }}>
          <span className="eyebrow">glossary</span>
          <h2>Terms used in this app</h2>
          <p className="lede">Grouped by topic. Each group links to the tab where you can watch it happen.</p>
        </div>
      </section>
      {GROUPS.map(([title, topic, tab, terms]) => {
        const Icon = TOPIC_ICONS[topic];
        return (
          <section key={title}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <h2 className="with-icon"><Icon size={20} />{title}</h2>
              <a href={`#${tab}`} className="note" style={{ marginTop: 0 }}>see it in action →</a>
            </div>
            <dl className="panel">
              {terms.map(([term, def]) => <div key={term}><dt>{term}</dt><dd>{def}</dd></div>)}
            </dl>
          </section>
        );
      })}
    </>
  );
}
