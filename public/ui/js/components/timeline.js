import { html } from '../html.js';
import { initials } from '../format.js';
import { statusPill } from './status-pill.js';

/**
 * One timeline row (Activity): the actor (person round, agent square, system without an avatar), what they did,
 * and a meta line with the system, the kind, the time and the cost of an agent action.
 */
export function timelineRow({ actor, kind = 'person', action, detail, system, time, cost, outcome }) {
  const avatar = kind === 'system'
    ? html`<span class="avatar avatar--small avatar--agent" aria-hidden="true">·</span>`
    : html`<span class="avatar avatar--small${kind === 'agent' ? ' avatar--agent' : ''}" aria-hidden="true">${initials(actor)}</span>`;
  const label = { person: 'Person', agent: 'Agent', system: 'System' }[kind] ?? kind;
  const meta = [label, time, cost, outcome].filter(Boolean).join(' · ');
  return html`<div class="timeline__row">${avatar}<div class="timeline__body"><span class="timeline__action">${action}</span>${detail ? html`<span class="row__meta">${detail}</span>` : ''}<span class="timeline__meta">${system ? statusPill({ text: system, tone: 'info', dot: false }) : ''}<span>${meta}</span></span></div></div>`;
}

/** A day heading (Today, Yesterday) followed by its rows. */
export const timelineDay = ({ day, rows }) => html`<div class="timeline__day">${day}</div>${rows.map(timelineRow)}`;
