export const money = (v: number) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);
