import { tone } from "./model";

export default function Badge({ status }: { status: string }) {
  return <span className="badge" style={tone(status)}>{status}</span>;
}
