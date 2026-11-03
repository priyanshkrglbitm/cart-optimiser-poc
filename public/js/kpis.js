// The stats strip and the collapsed "Stores in your area" list. Store data comes from GET /api/platforms;
// the saving number updates whenever results.js shows new totals (the 'basket:results' event).

import { getPlatforms } from './api.js';
import { escapeHtml, rupees, STORE_COLORS, storeAvatar } from './utils.js';

const set = (id, text) => { document.getElementById(id).textContent = text; };

export async function initKpis() {
  document.addEventListener('basket:results', e => showSaving(e.detail));

  try {
    const platforms = await getPlatforms();
    showStoreNumbers(platforms);
    showStoreList(platforms);
  } catch {
    set('kpi-stores', 'Unavailable');
    set('kpi-free', 'Unavailable');
    set('stores-summary', 'Could not load stores. Is the server running?');
  }
}

function showStoreNumbers(platforms) {
  set('kpi-stores', `${platforms.length} quick-commerce apps`);
  const cheapest = [...platforms].filter(p => p.freeDeliveryThreshold > 0).sort((a, b) => a.freeDeliveryThreshold - b.freeDeliveryThreshold)[0];
  if (cheapest) set('kpi-free', `${rupees(cheapest.freeDeliveryThreshold)} on ${cheapest.name}`);
}

/** The collapsed row says what is inside; the list opens on click. */
function showStoreList(platforms) {
  const fees = platforms.map(p => p.baseDeliveryFee).filter(Boolean);
  const thresholds = platforms.map(p => p.freeDeliveryThreshold).filter(Boolean);
  set('stores-summary', `${platforms.length} stores deliver here · delivery ${rupees(Math.min(...fees))}–${rupees(Math.max(...fees))} · free above ${rupees(Math.min(...thresholds))}–${rupees(Math.max(...thresholds))}`);
  document.getElementById('store-dots').innerHTML = platforms.map(p => `<span style="background:${STORE_COLORS[p.id] ?? '#64748b'}"></span>`).join('');

  document.getElementById('store-list').innerHTML = platforms.map(p => {
    const extra = p.handlingFee + p.platformFee;
    return `
      <li class="store-row">
        ${storeAvatar(p)}
        <div class="store-info">
          <strong>${escapeHtml(p.name)}</strong>
          <span class="meta">${escapeHtml(p.estimatedDelivery)}${extra ? ` · ${rupees(extra)} handling/platform` : ' · no extra fees'}</span>
        </div>
        <div class="store-fee">
          <strong>${p.baseDeliveryFee ? rupees(p.baseDeliveryFee) : 'Free'}</strong>
          ${p.freeDeliveryThreshold ? `free above ${rupees(p.freeDeliveryThreshold)}` : 'delivery'}
        </div>
      </li>`;
  }).join('');
}

/** How much the cheapest store saves against the most expensive store that has every item. */
function showSaving(data) {
  const complete = data.platformSummaries.filter(s => s.isFullyAvailable);
  if (complete.length < 2) {
    set('kpi-saving', complete.length ? 'Only one store has every item' : 'No store has every item');
    return;
  }
  const best = complete.reduce((a, b) => (b.totalCost < a.totalCost ? b : a));
  const priciest = complete.reduce((a, b) => (b.totalCost > a.totalCost ? b : a));
  set('kpi-saving', `${rupees(priciest.totalCost - best.totalCost)} on this basket`);
}
