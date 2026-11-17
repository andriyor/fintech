// Every tab, grouped for the sidebar. The journey is in the order money moves; the overview and prev/next follow it.
export const JOURNEY = [
  ["lifecycle", "Payment lifecycle", "Authorize, capture, clear and settle one payment, and watch its status change."],
  ["tokens", "Tokenization", "How the card number is swapped for tokens so the merchant never stores it."],
  ["fraud", "Fraud & risk", "Score a payment against rules and see the trade-off between fraud and false declines."],
  ["settlement", "Settlement", "Follow the money through interchange, scheme and processor fees to the merchant."],
  ["payouts", "Payouts", "Bundle balance entries into one bank transfer and see why it never matches a single sale."],
  ["chargebacks", "Chargebacks", "Play out a dispute: reasons, evidence, deadlines and who ends up with the money."],
  ["ledger", "Double-entry ledger", "Every event above as journal entries that always balance."],
] as const;

export const GROUPS = [
  ["Start", [["overview", "Overview"]]],
  ["The journey", JOURNEY.map(([id, name]) => [id, name] as const)],
  [
    "Reference",
    [
      ["terms", "Terms"],
      ["repo", "Repo data"],
    ],
  ],
] as const;

export type Tab = (typeof GROUPS)[number][1][number][0];
export const TAB_IDS: readonly Tab[] = GROUPS.flatMap(([, tabs]) => tabs.map(([id]) => id));
