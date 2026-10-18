import { html } from '../html.js';

/**
 * One L0 process arrow: processChevron({ code: 'SU', name: 'Supply', meta: '2 active specs', tone: 'value', href }).
 * Tones: default (Enterprise/Support), value (Value chain), active (selected).
 */
export function processChevron({ code, name, meta, tone, href }) {
  const cls = `chevron${tone ? ` chevron--${tone}` : ''}`;
  const body = html`<span class="chevron__code">${code}</span><span class="chevron__name">${name}</span>${meta ? html`<span class="chevron__meta">${meta}</span>` : ''}`;
  return href ? html`<a class="${cls}" href="${href}">${body}</a>` : html`<div class="${cls}">${body}</div>`;
}

/** A band of chevrons with its heading. */
export const chevronBand = ({ title, items }) => html`<section class="card__head" aria-label="${title}"><span class="eyebrow">${title}</span></section><div class="chevrons">${items.map(processChevron)}</div>`;
