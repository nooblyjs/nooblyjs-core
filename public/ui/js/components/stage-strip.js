import { html } from '../html.js';

export const STAGES = ['Discover', 'Specify', 'Architect', 'UX design', 'UI design', 'Build', 'Ship'];

/**
 * The seven lifecycle stages with a count and a note each: stageStrip({ stages: [{ name, count, note, href }],
 * current: 'Build' }). The current stage is said in words for screen readers, not only by colour.
 */
export function stageStrip({ stages, current }) {
  return html`<div class="stages">${stages.map((s, i) => {
    const isCurrent = s.name === current;
    const inner = html`<span class="stage__name">${i + 1} · ${s.name}${isCurrent ? html`<span class="visually-hidden"> (current)</span>` : ''}</span><span class="stage__count">${s.count}</span>${s.note ? html`<span class="stage__note">${s.note}</span>` : ''}`;
    const cls = `stage${isCurrent ? ' stage--current' : ''}`;
    return s.href ? html`<a class="${cls}" href="${s.href}"${isCurrent ? html` aria-current="step"` : ''}>${inner}</a>` : html`<div class="${cls}">${inner}</div>`;
  })}</div>`;
}
