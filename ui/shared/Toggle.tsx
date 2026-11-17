export default function Toggle<T extends string>({ value, set, options, label }: { value: T; set: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div className="inline-flex justify-self-start overflow-hidden rounded-[7px] border border-line" role="group" aria-label={label}>
      {options.map(([v, name]) => (
        <button key={v} aria-pressed={value === v} onClick={() => set(v)}
          className="cursor-pointer border-0 bg-transparent px-3 py-1.5 text-[13px] font-medium text-muted aria-pressed:bg-accent-soft aria-pressed:text-accent">
          {name}
        </button>
      ))}
    </div>
  );
}
