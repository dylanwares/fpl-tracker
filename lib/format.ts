/** Formatting helpers. Signed numbers matter here — the sign carries meaning. */

export function signed(n: number, digits = 1): string {
  const v = Number(n.toFixed(digits));
  if (v > 0) return `+${v.toFixed(digits)}`;
  if (v < 0) return `−${Math.abs(v).toFixed(digits)}`; // real minus sign
  return v.toFixed(digits);
}

export function price(m: number): string {
  return `£${m.toFixed(1)}m`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const STATUS_META: Record<
  string,
  { label: string; tone: 'ok' | 'warn' | 'bad' }
> = {
  a: { label: 'available', tone: 'ok' },
  d: { label: 'doubtful', tone: 'warn' },
  i: { label: 'injured', tone: 'bad' },
  s: { label: 'suspended', tone: 'bad' },
  u: { label: 'unavailable', tone: 'bad' },
  n: { label: 'not in squad', tone: 'bad' },
};

export function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.a;
}

/** difficulty 1..5 -> a colour for a fixture chip */
export function difficultyColor(d: number): string {
  if (d <= 2) return 'var(--gain)';
  if (d >= 4) return 'var(--threat)';
  return 'var(--muted)';
}
