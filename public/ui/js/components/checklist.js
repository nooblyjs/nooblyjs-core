import { html } from '../html.js';
import { icon } from '../icons.js';

/**
 * A checklist (readiness checks, "Your first week"): items: [{ text, state: 'done'|'failed'|'todo', note }].
 * Each item says its state in words.
 */
export function checklist({ items, label = 'Checklist' }) {
  const words = { done: 'Done', failed: 'Missing', todo: 'To do' };
  return html`<ul class="checklist" aria-label="${label}">${items.map((item) => {
    const state = words[item.state] ? item.state : 'todo';
    const mark = state === 'done' ? icon('check', { size: 14, stroke: 2.4 }) : state === 'failed' ? icon('alert', { size: 13, stroke: 2.2 }) : '';
    return html`<li class="checklist__item checklist__item--${state}"><span class="checklist__mark" aria-hidden="true">${mark}</span><span>${item.text}<br><span class="checklist__state">${item.note ?? words[state]}</span></span></li>`;
  })}</ul>`;
}
