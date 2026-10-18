import { html } from '../html.js';

const TONES = new Set(['info', 'success', 'warning', 'danger', 'navy', 'neutral']);

/** A status in words, with colour as a second signal: statusPill({ text: 'In review', tone: 'info' }). */
export function statusPill({ text, tone = 'neutral', dot = true }) {
  const t = TONES.has(tone) ? tone : 'neutral';
  return html`<span class="pill${t === 'neutral' ? '' : ` pill--${t}`}">${dot ? html`<span class="pill__dot" aria-hidden="true"></span>` : ''}${text}</span>`;
}
