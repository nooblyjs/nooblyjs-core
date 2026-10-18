import { html } from '../html.js';
import { icon } from '../icons.js';

/** The page header: eyebrow, title (the page's one h1), lead sentence and actions (SafeHtml). */
export const pageHead = ({ eyebrow, title, lead, actions }) =>
  html`<header class="page-head"><div class="page-head__text">${eyebrow ? html`<span class="eyebrow">${eyebrow}</span>` : ''}<h1 class="page-title">${title}</h1>${lead ? html`<p class="lead">${lead}</p>` : ''}</div>${actions ? html`<div class="actions">${actions}</div>` : ''}</header>`;

/** A card with a heading (h2) and a body (SafeHtml). */
export const card = ({ title, meta, body, label }) =>
  html`<section class="card"${label ? html` aria-label="${label}"` : ''}>${title ? html`<div class="card__head"><h2 class="card__title">${title}</h2>${meta ? html`<span class="card__meta">${meta}</span>` : ''}</div>` : ''}${body}</section>`;

/** A message in a card: placeholder, empty state or error (tone 'info' | 'muted' | 'error'), with optional actions. */
export const notice = ({ title, text, tone = 'info', iconName, actions, headingLevel = 2 }) => {
  const heading = headingLevel === 1 ? html`<h1 class="card__title">${title}</h1>` : html`<h2 class="card__title">${title}</h2>`;
  const ic = iconName ?? (tone === 'error' ? 'alert' : tone === 'muted' ? 'clock' : 'info');
  return html`<section class="card notice${tone === 'info' ? '' : ` notice--${tone}`}"${tone === 'error' ? html` role="alert"` : ''}><span class="notice__icon" aria-hidden="true">${icon(ic, { size: 22 })}</span>${heading}${text ? html`<p class="notice__text">${text}</p>` : ''}${actions ? html`<div class="actions">${actions}</div>` : ''}</section>`;
};
