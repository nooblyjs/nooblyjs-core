import { html } from '../html.js';
import { statusPill } from './status-pill.js';

/** One kanban column: kanbanColumn({ title, cards: [{ title, meta, pill?, href? }], empty }). */
export function kanbanColumn({ title, cards = [], empty = 'Nothing in this column.' }) {
  const items = cards.length
    ? cards.map((c) => html`<li class="kanban__card">${c.href ? html`<a class="kanban__title" href="${c.href}">${c.title}</a>` : html`<span class="kanban__title">${c.title}</span>`}${c.meta ? html`<span class="kanban__meta">${c.meta}</span>` : ''}${c.pill ? statusPill(c.pill) : ''}</li>`)
    : html`<li class="kanban__empty">${empty}</li>`;
  return html`<section class="kanban__col" aria-label="${title}"><h3 class="kanban__head">${title}<span class="kanban__count">${cards.length}</span></h3><ul class="rows" role="list">${items}</ul></section>`;
}

/** Several columns side by side. */
export const kanban = (columns) => html`<div class="kanban">${columns.map(kanbanColumn)}</div>`;
