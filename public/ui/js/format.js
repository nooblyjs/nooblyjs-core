// Formatting for people: money, counts, durations and relative times. en-ZA style digits.

const num = new Intl.NumberFormat('en-ZA');

/** "$142" or "$1,816"; cents only below $10 ("$0.84"). */
export function money(usd, { currency = 'USD' } = {}) {
  const value = Number(usd ?? 0);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0, minimumFractionDigits: Math.abs(value) < 10 && value % 1 ? 2 : 0 });
  return fmt.format(value);
}

export const count = (n) => num.format(Number(n ?? 0));

/** "9.4 d", "41 min", "26 h". */
export function duration(ms) {
  const minutes = Math.round(Number(ms ?? 0) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, '')} d`;
}

/** "12 min ago", "3 h ago", "yesterday", "2 Oct". */
export function ago(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return 'yesterday';
  return new Date(then).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/** Initials for an avatar: "Lerato M." → "LM", "Stevie" → "S". */
export const initials = (name) => String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
