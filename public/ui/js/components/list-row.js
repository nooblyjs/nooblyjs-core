import { html } from '../html.js';
import { initials } from '../format.js';
import { statusPill } from './status-pill.js';

/**
 * A row in a list: an avatar (round for people, square for agents), a title, a meta line, an optional pill and an
 * optional trailing action (SafeHtml, e.g. a button()).
 */
export function listRow({ title, meta, who, agent = false, pill, action, selected = false, href }) {
  const avatar = who ? html`<span class="avatar avatar--small${agent ? ' avatar--agent' : ''}" aria-hidden="true">${initials(who)}</span>` : '';
  const titleHtml = href ? html`<a class="row__title" href="${href}">${title}</a>` : html`<span class="row__title">${title}</span>`;
  return html`<div class="row${selected ? ' row--selected' : ''}">${avatar}<div class="row__main">${titleHtml}${meta ? html`<span class="row__meta">${meta}</span>` : ''}</div>${pill ? statusPill(pill) : ''}${action ?? ''}</div>`;
}
