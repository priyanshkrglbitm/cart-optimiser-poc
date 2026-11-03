// The AI shopping assistant: a floating button that opens a chat panel. It sends the conversation to
// POST /api/agent/chat and shows the reply, tap-to-answer options, the top products it found, and the tool calls it made.

import { agentChat } from './api.js';
import { escapeHtml, rupees } from './utils.js';

/**
 * @param {() => object} getLocation  current delivery location (with pincode)
 * @param {(basket: object) => void} showBasket  draws the full price comparison
 * @returns {{ send: (text: string) => void }}  lets other parts (the top-bar search) ask the assistant; opens the panel
 */
export function initAgent(getLocation, showBasket) {
  const list = document.getElementById('agent-messages');
  const form = document.getElementById('agent-form');
  const input = document.getElementById('agent-input');
  const sendButton = form.querySelector('button');
  const panel = document.getElementById('assistant');
  const fab = document.getElementById('assistant-fab');

  // Open/close the floating panel
  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    if (open) { input.focus(); list.scrollTo({ top: list.scrollHeight }); }
  }
  fab.addEventListener('click', () => setOpen(panel.hidden));
  document.getElementById('assistant-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

  // What the server needs: just the text of each message, oldest first
  const history = [];

  function addBubble(role, html) {
    const div = document.createElement('div');
    div.className = `bubble bubble-${role}`;
    div.innerHTML = html;
    list.appendChild(div);
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); // scroll the chat, not the page
    return div;
  }

  async function send(text) {
    const message = text.trim();
    if (!message) return;
    if (panel.hidden) setOpen(true);

    const location = getLocation();
    if (!/^[1-9]\d{5}$/.test(location.pincode)) {
      addBubble('agent', 'Please set a valid 6-digit pincode first: use the location button at the top.');
      return;
    }

    history.push({ role: 'user', content: message });
    addBubble('user', escapeHtml(message));
    const thinking = addBubble('agent', '<span class="spinner spinner-sm" aria-hidden="true"></span> Thinking…');
    input.disabled = sendButton.disabled = true;

    try {
      const res = await agentChat(history.slice(-20), location);
      history.push({ role: 'assistant', content: res.reply });
      thinking.innerHTML = replyHtml(res);
      list.scrollTo({ top: thinking.offsetTop - list.offsetTop - 8, behavior: 'smooth' }); // start of the reply
      if (res.basket) showBasket(res.basket);
    } catch (err) {
      history.pop(); // let the user resend the same message
      thinking.innerHTML = `<span class="error-text">${escapeHtml(err.message)}</span>`;
    } finally {
      input.disabled = sendButton.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    send(text);
  });

  // Tapping an option sends it as the user's answer
  list.addEventListener('click', e => {
    const option = e.target.closest('.agent-option');
    if (option) return send(option.dataset.text);
    // "View full comparison": close the panel and scroll to the results
    if (e.target.closest('.agent-show')) {
      setOpen(false);
      document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  addBubble('agent', 'Hi! Tell me what you want to buy, like "atta, butter and 12 eggs". I\'ll find the best options and the cheapest store.');
  return { send };
}

function replyHtml(res) {
  const text = escapeHtml(res.reply).replace(/\n/g, '<br>');
  const searches = res.searches.map(searchTableHtml).join('');
  const options = res.options?.length
    ? `<div class="chips">${res.options.map(o => `<button class="chip agent-option" type="button" data-text="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}</div>`
    : '';
  const basketNote = res.basket ? '<div class="chips"><button class="chip agent-show" type="button">View full comparison ↓</button></div>' : '';
  const steps = res.steps.length
    ? `<details class="agent-steps"><summary>How I got this (${res.steps.length} step${res.steps.length > 1 ? 's' : ''})</summary><ol>${res.steps
        .map(s => `<li><code>${escapeHtml(s.tool)}</code> ${escapeHtml(JSON.stringify(s.args))} → ${escapeHtml(s.summary)} <span class="meta">(${s.ms} ms)</span></li>`)
        .join('')}</ol></details>`
    : '';
  return `<p>${text}</p>${searches}${options}${basketNote}${steps}`;
}

/** Top products from one search_products call, as a small table. */
function searchTableHtml(search) {
  if (!search.products.length) return '';
  return `
    <details class="agent-search" open>
      <summary>Top ${search.products.length} for “${escapeHtml(search.query)}”</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th>#</th><th>Product</th><th>Best price</th><th class="col-unit">Per unit</th><th>Rating</th></tr></thead>
          <tbody>
            ${search.products.map(p => `
              <tr>
                <td>${p.rank}</td>
                <td>${escapeHtml(p.product)}</td>
                <td>${rupees(p.cheapestPrice)} <span class="meta">at ${escapeHtml(p.cheapestAt)}</span></td>
                <td class="col-unit">${escapeHtml(p.pricePerUnit)}</td>
                <td>★ ${p.rating} <span class="meta">(${Number(p.reviews).toLocaleString('en-IN')})</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>`;
}
