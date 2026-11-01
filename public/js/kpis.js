// KPI cards at the top and the "Stores in your area" list. Store data comes from GET /api/platforms;
// the basket cards update whenever results.js shows new totals (the 'basket:results' event).

import { getPlatforms } from './api.js';
import { escapeHtml, rupees } from './utils.js';

// Brand-ish colours for the store initials
const STORE_COLORS = {
  blinkit: '#f2c200',
  zepto: '#7b2cf5',
  instamart: '#fc8019',
  bigbasket: '#84c225',
  flipkart: '#2874f0',
  jiomart: '#0a6ebd',
};

const set = (id, text) => { document.getElementById(id).textContent = text; };

export async function initKpis() {
  document.addEventListener('basket:results', e => showBasketKpis(e.detail));

  try {
    const platforms = await getPlatforms();
    showStoreKpis(platforms);
    showStoreList(platforms);
  } catch {
    set('kpi-stores-sub', 'Could not load stores');
    set('kpi-free-sub', 'Could not load stores');
    document.getElementById('store-list').innerHTML = '<li class="meta">Could not load stores. Is the server running?</li>';
  }
}

function showStoreKpis(platforms) {
  set('kpi-stores', String(platforms.length));
  set('kpi-stores-sub', `${platforms.filter(p => p.type === 'QUICK_COMMERCE').length} quick-commerce apps`);

  const cheapest = [...platforms].filter(p => p.freeDeliveryThreshold > 0).sort((a, b) => a.freeDeliveryThreshold - b.freeDeliveryThreshold)[0];
  if (cheapest) {
    set('kpi-free', rupees(cheapest.freeDeliveryThreshold));
    set('kpi-free-sub', `on ${cheapest.name}`);
  }
}

function showStoreList(platforms) {
  document.getElementById('store-list').innerHTML = platforms.map(p => {
    const initials = p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const extra = p.handlingFee + p.platformFee;
    return `
      <li class="store-row">
        <span class="store-avatar" style="background:${STORE_COLORS[p.id] ?? '#64748b'}" aria-hidden="true">${escapeHtml(initials)}</span>
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

/** Best total and how much it saves against the most expensive store that has every item. */
function showBasketKpis(data) {
  const complete = data.platformSummaries.filter(s => s.isFullyAvailable);
  const best = [...complete].sort((a, b) => a.totalCost - b.totalCost)[0];

  if (!best) {
    set('kpi-best', '–');
    set('kpi-best-sub', 'No store has every item');
    set('kpi-saving', '–');
    set('kpi-saving-sub', 'No store has every item');
    return;
  }

  const priciest = complete.reduce((a, b) => (b.totalCost > a.totalCost ? b : a));
  set('kpi-best', rupees(best.totalCost));
  set('kpi-best-sub', `at ${best.platform.name}, fees included`);
  set('kpi-saving', rupees(priciest.totalCost - best.totalCost));
  set('kpi-saving-sub', complete.length > 1 ? `vs ${priciest.platform.name} (${rupees(priciest.totalCost)})` : 'Only one store has every item');
}
