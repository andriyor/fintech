export default function Toggle<T extends string>({ value, set, options, label }: { value: T; set: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div className="toggle" role="group" aria-label={label} style={{ justifySelf: "start" }}>
      {options.map(([v, name]) => <button key={v} aria-pressed={value === v} onClick={() => set(v)}>{name}</button>)}
    </div>
  );
}
