import { html } from '../html.js';

/** A number with its label and a line that explains it: statCard({ label: 'PRs merged', value: 38, note: 'from 12 approved specs' }). */
export function statCard({ label, value, note, highlight = false, href }) {
  const body = html`<span class="stat__label">${label}</span><span class="stat__value">${value}</span>${note ? html`<span class="stat__note">${note}</span>` : ''}`;
  const cls = `stat${highlight ? ' stat--highlight' : ''}`;
  return href ? html`<a class="${cls}" href="${href}">${body}</a>` : html`<div class="${cls}">${body}</div>`;
}
