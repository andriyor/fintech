// The parties in a card payment and one message between them ("merchant→processor").
export type Hop = { route: string; text: string };

export const ACTORS = [
  ["customer", "Customer", "cardholder"],
  ["merchant", "Merchant", "POS / site"],
  ["processor", "Processor", "Stripe, Adyen"],
  ["acquirer", "Acquiring bank", "merchant's bank"],
  ["network", "Card network", "Visa, Mastercard"],
  ["issuer", "Issuing bank", "customer's bank"],
] as const;
