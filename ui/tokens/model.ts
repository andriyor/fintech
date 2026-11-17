// Tokenization: who sees the real card number (PAN) under three ways of taking card payments.
// Every system that sees the PAN is in scope for PCI DSS; tokens keep it out of the merchant's systems.

export type SystemId = "device" | "server" | "db" | "processor" | "network" | "issuer";
export type Data = "pan" | "token" | "networkToken";
export type Step = { from: SystemId; to: SystemId; data: Data; text: string };
export type ApproachId = "direct" | "hosted" | "network";

export const SYSTEMS: { id: SystemId; name: string; owner: string; merchant: boolean }[] = [
  { id: "device", name: "Browser or phone", owner: "customer", merchant: false },
  { id: "server", name: "Merchant server", owner: "merchant", merchant: true },
  { id: "db", name: "Merchant database", owner: "merchant", merchant: true },
  { id: "processor", name: "Processor vault", owner: "processor", merchant: false },
  { id: "network", name: "Token service", owner: "card network", merchant: false },
  { id: "issuer", name: "Issuing bank", owner: "issuer", merchant: false },
];

export const DATA: Record<Data, { name: string; sample: string; note: string }> = {
  pan: {
    name: "Card number",
    sample: "4242 4242 4242 4242",
    note: "The real card number (PAN). Usable anywhere until the card is reissued.",
  },
  token: {
    name: "Processor token",
    sample: "tok_8fK2xQ7rLm",
    note: "A random reference to the card in the processor's vault. Worthless outside that processor and that merchant's account.",
  },
  networkToken: {
    name: "Network token",
    sample: "4895 3701 9876 1043 (+ cryptogram AgB3… for one payment)",
    note: "A stand-in card number issued by the card network, bound to one device or merchant, plus a cryptogram valid for a single payment.",
  },
};

export type Approach = {
  id: ApproachId;
  name: string;
  summary: string;
  steps: Step[];
  pci: string;
  breach: string;
  reissue: string; // the comparison table rows
};

export const APPROACHES: Approach[] = [
  {
    id: "direct",
    name: "Merchant server handles the card",
    summary:
      "The checkout form posts the card number to the merchant's own server, which charges it and keeps it for next time.",
    steps: [
      {
        from: "device",
        to: "server",
        data: "pan",
        text: "The customer types the card into the merchant's own form; it goes to the merchant's server.",
      },
      {
        from: "server",
        to: "db",
        data: "pan",
        text: "The server saves the card number to charge it again next month.",
      },
      {
        from: "server",
        to: "processor",
        data: "pan",
        text: "The server sends the card number to the processor to charge it.",
      },
      {
        from: "processor",
        to: "network",
        data: "pan",
        text: "The processor routes the authorization to the card network.",
      },
      { from: "network", to: "issuer", data: "pan", text: "The network forwards it to the issuer, which approves." },
    ],
    pci: "Full scope (SAQ D): hundreds of requirements across servers, database, network and staff.",
    breach: "Real card numbers leak. They work anywhere until every card is reissued.",
    reissue: "The stored number goes stale; the next recurring charge declines until the customer re-enters the card.",
  },
  {
    id: "hosted",
    name: "Hosted fields (processor token)",
    summary:
      "The card fields are an iframe served by the processor. The number goes straight to its vault; the merchant only ever gets a token.",
    steps: [
      {
        from: "device",
        to: "processor",
        data: "pan",
        text: "The card fields are the processor's iframe: the number goes straight to the processor's vault.",
      },
      {
        from: "processor",
        to: "device",
        data: "token",
        text: "The vault stores the card and returns a token to the page.",
      },
      { from: "device", to: "server", data: "token", text: "The page sends only the token to the merchant's server." },
      { from: "server", to: "db", data: "token", text: "The merchant stores the token for next time." },
      {
        from: "server",
        to: "processor",
        data: "token",
        text: "To charge, the server sends the token with its API key.",
      },
      {
        from: "processor",
        to: "network",
        data: "pan",
        text: "The vault swaps the token for the card number and routes the authorization.",
      },
      { from: "network", to: "issuer", data: "pan", text: "The issuer sees the real card, as always, and approves." },
    ],
    pci: "Reduced scope (SAQ A): a few dozen requirements; card data never touches the merchant's systems.",
    breach:
      "Only tokens leak. They can't be charged without the merchant's processor API key, and are useless elsewhere.",
    reissue: "The token still points at the old card; many processors refresh it with an account updater service.",
  },
  {
    id: "network",
    name: "Network token (wallet)",
    summary:
      "Apple Pay or Google Pay hold a network token on the device and add a one-time cryptogram to each payment. Even the processor never sees the card number.",
    steps: [
      {
        from: "device",
        to: "network",
        data: "pan",
        text: "Once, when the card is added to the wallet: the network's token service checks it with the issuer…",
      },
      {
        from: "network",
        to: "device",
        data: "networkToken",
        text: "…and puts a network token on the device. The real number is not kept there.",
      },
      {
        from: "device",
        to: "server",
        data: "networkToken",
        text: "At checkout the phone sends the network token and a fresh one-time cryptogram.",
      },
      {
        from: "server",
        to: "db",
        data: "networkToken",
        text: "The merchant can keep a merchant-bound network token for later; nobody else can use it.",
      },
      {
        from: "server",
        to: "processor",
        data: "networkToken",
        text: "The server passes the token and cryptogram to the processor.",
      },
      {
        from: "processor",
        to: "network",
        data: "networkToken",
        text: "The processor routes the token to the card network, still without the card number.",
      },
      {
        from: "network",
        to: "issuer",
        data: "pan",
        text: "The token service checks the cryptogram, swaps in the real number and asks the issuer to approve.",
      },
    ],
    pci: "Reduced scope (SAQ A when the wallet goes through the processor); the cryptogram also stops replayed payments.",
    breach: "Only network tokens leak, bound to this merchant or device, and every payment needs a new cryptogram.",
    reissue: "The issuer updates the card behind the token; stored tokens keep working, which raises approval rates.",
  },
];

/** Systems that have seen the real card number after the first `upto` steps (sender and receiver both). */
export function seenPan(a: Approach, upto = a.steps.length): Set<SystemId> {
  const seen = new Set<SystemId>();
  for (const s of a.steps.slice(0, upto)) if (s.data === "pan") seen.add(s.from).add(s.to);
  return seen;
}

/** What each system holds after the first `upto` steps: the last data it sent or received. */
export function holdings(a: Approach, upto = a.steps.length): Partial<Record<SystemId, Data>> {
  const held: Partial<Record<SystemId, Data>> = {};
  for (const s of a.steps.slice(0, upto)) {
    held[s.from] ??= s.data;
    held[s.to] = s.data;
  }
  return held;
}

/** Merchant-owned systems that see the card number: what the merchant must secure for PCI DSS. */
export const merchantScope = (a: Approach) => SYSTEMS.filter(s => s.merchant && seenPan(a).has(s.id)).map(s => s.id);
