// The frame's chrome as HTML (structure.md §2a): suite rail, module sidebar (nav groups and badges, status card,
// person) and the chat dock. Pure functions over the data from GET /api/v1/shell, so they can be tested in Node.
import { html } from './html.js';
import { icon } from './icons.js';
import { initials } from './format.js';
import { statusPill } from './components/status-pill.js';
import { meter } from './components/meter.js';
import { fullPath } from './router.js';

const STATE_TEXT = { 'not-installed': 'Not installed yet', unavailable: 'Unavailable', 'not-running-here': 'Not running here' };

/** The suite rail: the logo (Home), then one item per app with `rail: true`, in the order given. */
export function renderRail(apps, currentName) {
  const items = apps.filter((a) => a.rail).map((a) => {
    const current = a.name === currentName;
    const stateText = STATE_TEXT[a.state];
    return html`<a class="rail__item" href="${a.mountPath}" data-app="${a.name}"${current ? html` aria-current="page"` : ''}>${icon(a.icon, { size: 22, stroke: 1.7 })}<span>${a.label}</span>${stateText ? html`<span class="rail__state">${stateText}</span>` : ''}</a>`;
  });
  return html`<a class="rail__logo" href="/" aria-label="NooblyJS home"><span></span><span></span></a>${items}`;
}

/** Nav rows, grouped where rows carry a `group` (Product's Stages / Flow, Platform's Build / Govern). */
export function renderNav(app, { currentKey, badges = {} } = {}) {
  let lastGroup;
  const rows = [];
  for (const row of app.nav ?? []) {
    if (row.group && row.group !== lastGroup) rows.push(html`<span class="nav__group">${row.group}</span>`);
    lastGroup = row.group;
    const current = row.key === currentKey;
    const badge = row.badge && Number(badges[row.badge]) > 0 ? badges[row.badge] : null;
    rows.push(html`<a class="nav__item" href="${fullPath(app.mountPath, row.path)}" data-nav="${row.key}"${current ? html` aria-current="page"` : ''}><span class="nav__label">${icon(row.icon ?? 'dot', { size: 18 })}${row.label}</span>${badge !== null ? html`<span class="nav__badge">${badge}<span class="visually-hidden"> waiting</span></span>` : ''}</a>`);
  }
  return rows.length ? html`<nav class="nav" aria-label="${app.label}">${rows}</nav>` : '';
}

/**
 * The status card (AppStatus.card): { pill: { text, tone }, items: [{ label, value }], meter: { label, value, ratio,
 * tone }, lines: [string] }. Every part is optional.
 */
export function renderStatusCard(card) {
  if (!card) return '';
  const pill = card.pill ? statusPill({ text: card.pill.text, tone: card.pill.tone ?? 'info' }) : '';
  const items = (card.items ?? []).map((i) => html`<div class="status-card__item"><span class="status-card__label">${i.label}</span><span class="status-card__value">${i.value}</span></div>`);
  const lines = (card.lines ?? []).map((l) => html`<span class="status-card__line">${l}</span>`);
  const bar = card.meter ? meter(card.meter) : '';
  if (!pill && !items.length && !lines.length && !bar) return '';
  return html`<section class="status-card" aria-label="Status">${pill}${items}${bar}${lines}</section>`;
}

const ROLE_LABEL = {
  'product-manager': 'Product manager', architect: 'Architect', developer: 'Developer', designer: 'Designer',
  'engineering-lead': 'Engineering lead', 'platform-engineer': 'Platform engineer',
};

/** The signed-in person, with Sign out (a real form: it works without the frame's JavaScript too). */
export function renderPerson(person, csrfToken) {
  if (!person) return '';
  const role = ROLE_LABEL[person.workRole] ?? (person.workRole || 'New joiner');
  return html`<div class="person"><span class="avatar" aria-hidden="true">${initials(person.name)}</span><span class="person__who"><span class="person__name">${person.name}</span><span class="person__role" title="${role} · ${person.accessRole}">${role} · ${person.accessRole}</span></span><form method="post" action="/logout" class="person__form"><input type="hidden" name="_csrf" value="${csrfToken}"><button class="person__out" type="submit" title="Sign out" data-reload>${icon('out', { size: 18 })}<span class="visually-hidden">Sign out</span></button></form></div>`;
}

/** The whole sidebar for one app. */
export function renderSidebar(app, { currentKey, status, person, csrfToken } = {}) {
  const tag = app.tag ? html`<span class="sidebar__tag">${app.tag}</span>` : '';
  const stateNote = STATE_TEXT[app.state] ? html`<p class="status-card__line">${STATE_TEXT[app.state]}</p>` : '';
  return html`<div class="sidebar__head"><span class="sidebar__title">${app.title ?? app.label.toLowerCase()}</span>${tag}</div>${stateNote}${renderNav(app, { currentKey, badges: status?.badges })}<div class="sidebar__foot">${renderStatusCard(status?.card)}${renderPerson(person, csrfToken)}</div>`;
}

/** The chat dock where there is no chat service (a child app running on its own): team chat belongs to NooblyJS. */
export function renderChatDock(scope) {
  return html`<h2 class="chat-dock__title">Team chat</h2><p class="status-card__line">About ${scope.kind} ${scope.id}</p><section class="card notice notice--muted"><span class="notice__icon" aria-hidden="true">${icon('chat', { size: 22 })}</span><p class="notice__text">Team chat with people and agent teammates is part of NooblyJS. This app is running on its own, so the thread for this ${scope.kind} isn't available here.</p></section>`;
}
