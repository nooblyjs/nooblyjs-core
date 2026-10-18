import { html } from '../html.js';

/**
 * A table that scrolls inside its card. columns: [{ key, label, numeric?, render?(row) → SafeHtml|string }].
 * An empty table says so in words (`empty`).
 */
export function dataTable({ columns, rows, caption, empty = 'Nothing here yet.' }) {
  const head = columns.map((c) => html`<th scope="col"${c.numeric ? html` class="num"` : ''}>${c.label}</th>`);
  const body = rows.length
    ? rows.map((row) => html`<tr>${columns.map((c) => html`<td${c.numeric ? html` class="num"` : ''}>${c.render ? c.render(row) : row[c.key]}</td>`)}</tr>`)
    : html`<tr><td class="table__empty" colspan="${columns.length}">${empty}</td></tr>`;
  return html`<div class="table-wrap" tabindex="0" role="region" aria-label="${caption ?? 'Table'}"><table class="table">${caption ? html`<caption class="visually-hidden">${caption}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
