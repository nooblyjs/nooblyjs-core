import { html } from '../html.js';
import { STAGES } from './stage-strip.js';

const STATE_TEXT = { done: 'Done', now: 'Now', waiting: 'Waiting too long', todo: 'Not reached' };

/**
 * The item × stage swimlane (Lifecycle): rows: [{ title, id, href?, age, late?, cells: { <stage>: { state, text } } }].
 * `stages` are names, or { key, label } pairs when the cells are keyed by a stage key. A stage an item has passed is
 * a bar, the stage it is in says who has it ("Your review", "Rhea drafting"), and one that has waited too long is
 * amber. Every cell also states its status in words for screen readers, never by colour alone.
 */
export function swimlane({ rows, stages = STAGES, caption = 'Items by stage', empty = 'Nothing in flight.' }) {
  const cols = stages.map((s) => (typeof s === 'string' ? { key: s, label: s } : s));
  const head = html`<tr><th scope="col">Item</th>${cols.map((s) => html`<th scope="col">${s.label}</th>`)}<th scope="col" class="swimlane__age">Age</th></tr>`;
  const body = rows.length ? rows.map((row) => {
    const title = row.href ? html`<a href="${row.href}"><strong>${row.title}</strong></a>` : html`<strong>${row.title}</strong>`;
    return html`<tr><th scope="row" class="swimlane__item">${title}<span class="swimlane__id">${row.id}</span></th>${cols.map((s) => {
      const cell = row.cells?.[s.key];
      const state = STATE_TEXT[cell?.state] ? cell.state : 'todo';
      const text = cell?.text ?? '';
      if (state === 'now' || state === 'waiting') {
        return html`<td><span class="swimlane__cell swimlane__cell--${state}">${text}<span class="visually-hidden">${text ? ` (${STATE_TEXT[state]})` : STATE_TEXT[state]}</span></span></td>`;
      }
      return html`<td><span class="swimlane__bar swimlane__bar--${state}"><span class="visually-hidden">${STATE_TEXT[state]}</span></span></td>`;
    })}<td class="swimlane__age${row.late ? ' swimlane__age--late' : ''}">${row.age ?? ''}</td></tr>`;
  }) : html`<tr><td class="table__empty" colspan="${cols.length + 2}">${empty}</td></tr>`;
  const legend = html`<div class="legend" aria-hidden="true">${['done', 'now', 'waiting'].map((s) => html`<span class="legend__key"><span class="legend__swatch swimlane__swatch--${s}"></span>${STATE_TEXT[s]}</span>`)}</div>`;
  return html`${legend}<div class="table-wrap" tabindex="0" role="region" aria-label="${caption}"><table class="swimlane"><caption class="visually-hidden">${caption}</caption><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
