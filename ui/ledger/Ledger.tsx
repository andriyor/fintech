import { useState } from "react";
import { money } from "../shared/money";
import Toggle from "../shared/Toggle";
import {
  ACCOUNTS,
  EVENTS,
  KINDS,
  available,
  balances,
  equation,
  normal,
  post,
  total,
  type Account,
  type Book,
  type Entry,
  type EventKind,
} from "./model";

const usd = (cents: number) => money(cents / 100);
const BOOKS: [Book, string][] = [
  ["merchant", "Merchant's books"],
  ["processor", "Processor's books"],
];
const nameOf = (book: Book, id: string) => ACCOUNTS[book].find(a => a.id === id)!.name;

function Journal({
  book,
  entries,
  sel,
  select,
}: {
  book: Book;
  entries: Entry[];
  sel: number;
  select: (n: number) => void;
}) {
  if (!entries.length) {
    return <p className="lede">No entries yet. Post an event to write the first journal entry.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th className="n">Debit</th>
            <th className="n">Credit</th>
          </tr>
        </thead>
        {entries.map(e => {
          const lines = e.lines[book];
          return (
            <tbody
              key={e.n}
              onClick={() => select(e.n)}
              className={"cursor-pointer " + (e.n === sel ? "[&_td]:bg-accent-soft" : "hover:[&_td]:bg-idle-soft")}
            >
              <tr className="font-semibold [&>td]:border-b-0 [&>td]:pt-2.5">
                <td>
                  <button
                    className="min-w-6.5 cursor-pointer rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[12px] font-semibold text-fg aria-pressed:border-accent aria-pressed:text-accent"
                    aria-pressed={e.n === sel}
                    onClick={() => select(e.n)}
                  >
                    {e.n}
                  </button>
                </td>
                <td colSpan={3}>{e.title}</td>
              </tr>
              {lines.length ? (
                lines.map((l, i) => (
                  <tr key={i}>
                    <td />
                    <td className={l.side === "cr" ? "pl-8" : ""}>{nameOf(book, l.account)}</td>
                    <td className="n">{l.side === "dr" ? usd(l.cents) : ""}</td>
                    <td className="n">{l.side === "cr" ? usd(l.cents) : ""}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td />
                  <td colSpan={3} className="note mt-0">
                    no entry in these books
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function TAccount({
  book,
  a,
  entries,
  balance,
  sel,
}: {
  book: Book;
  a: Account;
  entries: Entry[];
  balance: number;
  sel: number;
}) {
  const rows = entries.flatMap(e => e.lines[book].filter(l => l.account === a.id).map(l => ({ n: e.n, ...l })));
  const side = (s: "dr" | "cr") =>
    rows
      .filter(r => r.side === s)
      .map((r, i) => (
        <span key={i} className={"flex justify-between gap-1.5 " + (r.n === sel ? "font-semibold text-accent" : "")}>
          <em className="text-muted not-italic">{r.n}</em>
          {usd(r.cents)}
        </span>
      ));
  const on = rows.some(r => r.n === sel);
  return (
    <div
      className={
        "rounded-lg border px-3 py-2.5 text-[13px] transition " + (on ? "border-accent bg-accent-soft" : "border-line")
      }
      title={a.note}
    >
      <h4 className="mt-0 mb-1.5 flex justify-between gap-2 text-[13px] font-semibold">
        {a.name}
        <small className="font-mono text-[10px] tracking-wider text-muted uppercase">
          {normal(a.kind) === "dr" ? "debit +" : "credit +"}
        </small>
      </h4>
      <div className="grid min-h-9 grid-cols-2 border-t-2 border-fg font-mono text-[12px] tabular-nums [&>div]:grid [&>div]:min-w-0 [&>div]:content-start [&>div]:gap-0.5 [&>div]:px-1.5 [&>div]:py-1">
        <div className="border-r-2 border-fg">{side("dr")}</div>
        <div>{side("cr")}</div>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[12px] font-semibold">
        <span>balance</span>
        <span className={balance < 0 ? "text-bad" : undefined}>{usd(balance)}</span>
      </div>
    </div>
  );
}

export default function Ledger() {
  const [events, setEvents] = useState<EventKind[]>([]);
  const [book, setBook] = useState<Book>("merchant");
  const [sel, setSel] = useState(0);
  const entries = post(events);
  const b = balances(entries);
  const can = available(events);
  const entry = entries.find(e => e.n === sel);
  const lines = entries.flatMap(e => e.lines[book]);
  const q = equation(book, b);

  function add(k: EventKind) {
    setEvents(es => [...es, k]);
    setSel(events.length + 1);
  }

  return (
    <>
      <section>
        <div className="grid gap-1.5">
          <span className="eyebrow">the books behind every payment</span>
          <h2>Double-entry: every movement is written twice</h2>
          <p className="lede">
            Money never appears or disappears. It moves from one account to another, so each journal entry has debits
            and credits that add up to the same amount. Post card events below and watch the same event land in two sets
            of books: the merchant's and the processor's.
          </p>
        </div>
        <div className="panel grid gap-3.5">
          <div className="actions mt-0">
            {EVENTS.map(([k, label]) => (
              <button
                key={k}
                className={"act" + (k === "sale" ? "" : " alt")}
                disabled={!!can[k]}
                title={can[k] ?? undefined}
                onClick={() => add(k)}
              >
                {k === "payout" && b.merchant.recv < 0 ? "Collect negative balance" : label}
              </button>
            ))}
            {events.length > 0 && (
              <button
                className="act alt"
                onClick={() => {
                  setEvents([]);
                  setSel(0);
                }}
              >
                Start over
              </button>
            )}
          </div>
          <Toggle label="Whose books" value={book} set={setBook} options={BOOKS} />
          {entry && (
            <p className="rounded-r-md border-l-[3px] border-hold bg-hold-soft px-3 py-2 text-[14px]">
              <strong>
                #{entry.n} {entry.title}.
              </strong>{" "}
              {entry.why[book]}
            </p>
          )}
        </div>
      </section>
      <section className="sim">
        <div className="panel grid content-start gap-2.5">
          <div className="eyebrow">Journal · click an entry to trace it</div>
          <Journal book={book} entries={entries} sel={sel} select={setSel} />
        </div>
        <div className="panel grid content-start gap-3">
          <div className="eyebrow">Checks</div>
          <div className="ledger">
            <div className="row">
              <span>Total debits</span>
              <span>{usd(total(lines, "dr"))}</span>
            </div>
            <div className="row">
              <span>Total credits</span>
              <span>{usd(total(lines, "cr"))}</span>
            </div>
            <div className="row">
              <span>Assets</span>
              <span>{usd(q.assets)}</span>
            </div>
            <div className="row">
              <span>= Liabilities</span>
              <span>{usd(q.liabilities)}</span>
            </div>
            <div className="row">
              <span>+ Equity (revenue − expenses)</span>
              <span>{usd(q.equity)}</span>
            </div>
          </div>
          <p className="note mt-0">
            Mirror: the merchant's <em>Due from processor</em> ({usd(b.merchant.recv)}) always equals the processor's{" "}
            <em>Owed to merchant</em> ({usd(b.processor.payable)}). The same money is an asset in one set of books and a
            liability in the other.
          </p>
          <p className="note mt-0">
            Debit and credit are just left and right. Assets and expenses grow on the debit side; liabilities and
            revenue grow on the credit side.
          </p>
        </div>
      </section>
      <section className="panel grid gap-4">
        <div className="eyebrow">
          T-accounts · {book === "merchant" ? "merchant" : "processor"} · hover an account for what it means
        </div>
        {KINDS.map(([kind, label]) => {
          const accts = ACCOUNTS[book].filter(a => a.kind === kind);
          return (
            accts.length > 0 && (
              <div key={kind} className="grid gap-2">
                <h3 className="eyebrow m-0">{label}</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
                  {accts.map(a => (
                    <TAccount key={a.id} book={book} a={a} entries={entries} balance={b[book][a.id]} sel={sel} />
                  ))}
                </div>
              </div>
            )
          );
        })}
      </section>
      <p className="note">
        Illustrative: $100 sales, blended pricing 2.9% + 30¢, interchange and scheme fees ~1.8% + 10¢, $15 dispute fee.
        Refunds and chargebacks are booked against the processor balance; taxes, reserves and accrual timing are left
        out.
      </p>
    </>
  );
}
