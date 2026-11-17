// One icon per tab, reused wherever a topic is named (tabs, glossary headings), so a topic always looks the same.
import { ArrowLeftRight, BookA, Banknote, CreditCard, Database, Fingerprint, KeyRound, Scale, ShieldAlert, Users, type LucideIcon } from "lucide-react";

export const TOPIC_ICONS: Record<string, LucideIcon> = {
  lifecycle: CreditCard,
  tokens: KeyRound,
  fraud: Fingerprint,
  settlement: ArrowLeftRight,
  payouts: Banknote,
  chargebacks: ShieldAlert,
  ledger: Scale,
  terms: BookA,
  repo: Database,
  parties: Users,
};
