import { html } from '../html.js';
import { icon } from '../icons.js';
import { button } from './button.js';
import { statusPill } from './status-pill.js';

const STATE = { approved: ['Approved', 'success'], declined: ['Declined', 'danger'], applied: ['Applied', 'success'] };

const who = (card) => (card.decidedByName ? ` by ${card.decidedByName}` : '');

/**
 * A structured card inside a chat message (product.md §5.9): plan · comparison · pr-link · facts · approval.
 * `can(permission)` says whether the reader's access role could act (a hint: the API decides). Actions are real
 * buttons carrying data-chat-action ("apply", "approve", "decline") and data-card.
 */
export function chatCard(card, { can = () => false } = {}) {
  const done = STATE[card.status];
  const state = done ? html`<p class="chat-card__state">${statusPill({ text: `${done[0]}${who(card)}${card.appliedVersion ? ` · spec v${card.appliedVersion}` : ''}`, tone: done[1], dot: false })}</p>` : '';
  const act = (action, label, kind = 'primary') => button({ label, kind, small: true, attrs: { 'data-chat-action': action, 'data-card': card.id, 'aria-label': `${label}: ${card.title}` } });

  if (card.type === 'plan') {
    return html`<section class="chat-card" aria-label="Plan: ${card.title}"><h4 class="chat-card__title">${card.title}</h4>
      <ol class="chat-card__steps">${(card.steps ?? []).map((s) => html`<li>${s}</li>`)}</ol>
      ${done ? state : card.apply ? (can('draft') ? html`<div class="chat-card__actions">${act('apply', card.apply.label ?? 'Apply')}</div>` : html`<p class="chat-card__note">Someone with the "draft" permission can apply this.</p>`) : ''}
    </section>`;
  }
  if (card.type === 'comparison') {
    return html`<section class="chat-card" aria-label="Comparison: ${card.title}"><h4 class="chat-card__title">${card.title}</h4>
      <div class="chat-card__scroll" tabindex="0" role="region" aria-label="${card.title}"><table class="chat-card__table">
        <thead><tr><td></td>${(card.columns ?? []).map((c) => html`<th scope="col">${c}</th>`)}</tr></thead>
        <tbody>${(card.rows ?? []).map((r) => html`<tr><th scope="row">${r.label}</th>${(r.values ?? []).map((v) => html`<td>${v}</td>`)}</tr>`)}</tbody>
      </table></div>
    </section>`;
  }
  if (card.type === 'pr-link') {
    return html`<section class="chat-card chat-card--link" aria-label="Pull request"><span class="chat-card__icon" aria-hidden="true">${icon('repo', { size: 18 })}</span>
      <div><a class="chat-card__title" href="${card.href ?? '#'}">${card.title}</a>${card.status ? html`<p class="chat-card__note">${card.status}</p>` : ''}</div>
    </section>`;
  }
  if (card.type === 'facts') {
    return html`<section class="chat-card" aria-label="Facts: ${card.title}"><h4 class="chat-card__title">${card.title}</h4>
      <dl class="chat-card__facts">${(card.rows ?? []).map((r) => html`<div><dt>${r.label}</dt><dd>${r.value}</dd></div>`)}</dl>
      ${card.link ? html`<a href="${card.link.href}">${card.link.label}</a>` : ''}
    </section>`;
  }
  if (card.type === 'approval') {
    const open = !done && card.status === 'open';
    return html`<section class="chat-card chat-card--approval" aria-label="Approval needed: ${card.title}">
      <span class="chat-card__eyebrow">Needs a person's approval</span><h4 class="chat-card__title">${card.title}</h4>
      ${card.text ? html`<p class="chat-card__text">${card.text}</p>` : ''}
      ${done ? state : ''}
      ${open ? (can(card.requires)
    ? html`<div class="chat-card__actions">${act('approve', 'Approve')}${act('decline', 'Decline', 'secondary')}</div>`
    : html`<p class="chat-card__note">Only someone with the "${card.requires}" permission can answer this. Agents never can.</p>`) : ''}
    </section>`;
  }
  return html`<section class="chat-card"><h4 class="chat-card__title">${card.title ?? 'Card'}</h4></section>`;
}
