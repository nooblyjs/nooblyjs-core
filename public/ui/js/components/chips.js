import { html } from '../html.js';

/**
 * A row of filter buttons, one pressed (the mockups' "Waiting on you 4 · Waiting on others 6", "Everything · People"):
 * chips({ label: 'Show', name: 'tab', items: [{ value: 'mine', label: 'Waiting on you', count: 4 }], current: 'mine' }).
 * Each is a real button with aria-pressed and data-<name>="<value>"; the page listens for clicks. An item with
 * `divider: true` draws a separator before it. `small` gives the 44px-tall quiet variant used above a list.
 */
export function chips({ label, name = 'value', items, current, small = false }) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`chips: name must be a lower-case attribute suffix, not "${name}".`);
  return html`<div class="chips${small ? ' chips--small' : ''}" role="group" aria-label="${label}">${items.map((item) => {
    const pressed = item.value === current;
    const count = item.count === undefined || item.count === null ? '' : html` <span class="chip__count">${item.count}</span>`;
    return html`${item.divider ? html`<span class="chips__divider" aria-hidden="true"></span>` : ''}<button type="button" class="chip" data-${name}="${item.value}" aria-pressed="${pressed ? 'true' : 'false'}">${item.label}${count}</button>`;
  })}</div>`;
}
