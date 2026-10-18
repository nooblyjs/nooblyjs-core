import { html } from '../html.js';
import { icon } from '../icons.js';

const KINDS = new Set(['primary', 'accent', 'secondary', 'danger']);

/**
 * A button (or a link styled as one when `href` is given). Kinds: primary, accent, secondary, danger.
 * `attrs` adds data-* attributes, e.g. { 'data-action': 'retry' }.
 */
export function button({ label, kind = 'primary', href, icon: iconName, small = false, disabled = false, type = 'button', attrs = {} }) {
  const cls = `btn btn--${KINDS.has(kind) ? kind : 'primary'}${small ? ' btn--small' : ''}`;
  const extra = Object.entries(attrs).filter(([k]) => /^(data-[a-z0-9-]+|aria-[a-z]+|name|value)$/.test(k));
  const attrHtml = extra.map(([k, v]) => html` ${k}="${v}"`);
  const inner = html`${iconName ? icon(iconName, { size: 16, stroke: 2 }) : ''}${label}`;
  if (href) {
    return html`<a class="${cls}" href="${href}"${disabled ? html` aria-disabled="true"` : ''}${attrHtml}>${inner}</a>`;
  }
  return html`<button class="${cls}" type="${type === 'submit' ? 'submit' : 'button'}"${disabled ? html` disabled` : ''}${attrHtml}>${inner}</button>`;
}
