import { html, escapeHtml, raw } from '../html.js';
import { initials, money, ago } from '../format.js';
import { button } from './button.js';
import { chatCard } from './chat-card.js';

/** A message's text: escaped, line breaks kept, and the @mentions it resolved marked. */
export function chatText(text, mentions = []) {
  const names = new Set(mentions.flatMap((m) => [m.id.toLowerCase(), String(m.name).split(/\s+/)[0].toLowerCase()]));
  const marked = escapeHtml(text).replace(/(^|[^\w@])@([A-Za-z][\w.-]{0,40})/g, (all, lead, token) => {
    const t = token.replace(/[.,-]+$/, '');
    return names.has(t.toLowerCase()) ? `${lead}<span class="chat-mention">@${t}</span>${token.slice(t.length)}` : all;
  });
  return raw(marked.replace(/\n/g, '<br>'));
}

/**
 * One message (product.md §5.9). A person has a round avatar; an agent a square one, an "Agent" tag and a tinted
 * bubble; a system line records what changed because of the thread ("spec v5") and has no avatar.
 */
export function chatMessage(m, { personId, can, now = Date.now() } = {}) {
  if (m.author.kind === 'system') {
    return html`<li class="chat-line" data-message="${m.id}"><span class="chat-line__text">${chatText(m.text)}</span>${(m.cards ?? []).map((c) => chatCard(c, { can }))}<span class="chat-line__time">${ago(m.at, now)}</span></li>`;
  }
  const agent = m.author.kind === 'agent';
  const mine = m.author.id === personId;
  const citations = (m.citations ?? []).length
    ? html`<ol class="chat-cites" aria-label="Sources">${m.citations.map((c) => html`<li><span class="chat-cites__n">${c.n}</span><span><span class="chat-cites__title">${c.title}</span><span class="chat-cites__meta">${[c.type, c.where, c.freshness].filter(Boolean).join(' · ')}</span></span></li>`)}</ol>`
    : '';
  return html`<li class="chat-msg${agent ? ' chat-msg--agent' : ''}${mine ? ' chat-msg--mine' : ''}" data-message="${m.id}">
    <span class="avatar avatar--small${agent ? ' avatar--agent' : ''}" aria-hidden="true">${initials(m.author.name)}</span>
    <div class="chat-msg__body">
      <div class="chat-msg__head"><span class="chat-msg__name">${mine ? 'You' : m.author.name}</span>${agent ? html`<span class="chat-msg__tag">Agent</span>` : ''}<span class="chat-msg__time">${ago(m.at, now)}</span></div>
      <div class="chat-bubble${agent ? ' chat-bubble--agent' : ''}">${chatText(m.text, m.mentions)}</div>
      ${(m.cards ?? []).map((c) => chatCard(c, { can }))}
      ${citations}
      ${agent && m.costUsd ? html`<span class="chat-msg__cost">${money(m.costUsd)} for this answer</span>` : ''}
    </div>
  </li>`;
}

export const chatLog = (messages, opts) => (messages.length
  ? html`${messages.map((m) => chatMessage(m, opts))}`
  : html`<li class="chat-empty">No messages yet. Mention a person or an agent teammate with @ to bring them in.</li>`);

export const chatWorking = (working) => (working.length
  ? html`<span class="chat-working__dots" aria-hidden="true"><span></span><span></span><span></span></span>${working.map((w) => w.name).join(' and ')} ${working.length === 1 ? 'is' : 'are'} working…`
  : '');

/** The whole docked panel: title, log, working line, quick-action chips and the composer. */
export function chatPanel({ thread, messages, chips = [], working = [], mentionable = [], canPost = false }, opts = {}) {
  const hint = mentionable.filter((p) => p.kind === 'agent').slice(0, 3).map((p) => `@${p.handle}`).join(', ');
  return html`<header class="chat-head"><h2 class="chat-dock__title">Team chat</h2><p class="chat-head__thread">${thread.itemHref ? html`<a href="${thread.itemHref}">${thread.title}</a>` : thread.title}</p></header>
    <div class="chat-log" role="log" aria-label="Messages in ${thread.title}" tabindex="0" data-chat="log"><ol class="chat-log__list" data-chat="list">${chatLog(messages, opts)}</ol></div>
    <p class="chat-working" role="status" data-chat="working">${chatWorking(working)}</p>
    <p class="chat-error" role="alert" data-chat="error" hidden></p>
    ${chips.length ? html`<div class="chat-chips" role="group" aria-label="Quick actions">${chips.map((c) => html`<button type="button" class="chat-chip" data-chat-action="chip" data-chip="${c.action}">${c.label}</button>`)}</div>` : ''}
    ${canPost ? html`<form class="chat-form" data-chat="form">
      <label class="visually-hidden" for="noobly-chat-text">Message ${thread.title}</label>
      <textarea id="noobly-chat-text" name="text" rows="2" maxlength="4000" placeholder="Write a message. ${hint ? `Try ${hint}` : ''}" required></textarea>
      <div class="chat-form__foot"><span class="chat-form__hint">Enter sends · Shift+Enter for a new line</span>${button({ label: 'Send', type: 'submit', small: true })}</div>
    </form>` : html`<p class="chat-card__note">You can read this thread. Posting needs the "draft" permission.</p>`}`;
}
