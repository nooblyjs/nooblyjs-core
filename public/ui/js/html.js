// A tagged template that escapes every interpolated value unless it is already SafeHtml (tech.md §5: never put
// untrusted text into HTML unescaped). Arrays are joined; null, undefined and false render as nothing.
// Components return SafeHtml, so `view.innerHTML = String(component(...))` stays safe.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export class SafeHtml {
  constructor(text) {
    this.text = text;
  }

  toString() {
    return this.text;
  }
}

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Marks trusted markup (e.g. an icon's SVG) as safe. Never pass text that came from a person or an API. */
export const raw = (text) => new SafeHtml(String(text));

const render = (value) => {
  if (value instanceof SafeHtml) return value.text;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
};

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}
