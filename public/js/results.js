// Draws the results: a winner card for the selected store, a table comparing every store, and the split plan.
// Click a row in the table to look at that store's basket in the card.

import { escapeHtml, rupees, storeAvatar } from './utils.js';

const resultsEl = document.getElementById('results');

// Last server response. Store totals change here when the user picks a different product.
let data = null;
let selectedId = null; // store shown in the card; null = the cheapest

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function renderEmpty() {
  resultsEl.innerHTML = '';
}

export function renderLoading(itemCount) {
  resultsEl.innerHTML = `
    <div class="loading">
      <div class="spinner" aria-hidden="true"></div>
      <span>Checking ${itemCount} item${itemCount > 1 ? 's' : ''} across stores…</span>
    </div>
    <div class="skeleton"></div>`;
}

export function renderError(message) {
  resultsEl.innerHTML = `<div class="alert alert-error"><strong>Couldn't compare prices.</strong><p>${escapeHtml(message)}</p></div>`;
}

export function renderResults(response) {
  data = response;
  selectedId = null;
  draw();
}

/** Tells the rest of the page (the savings number) that totals changed. */
function announce() {
  document.dispatchEvent(new CustomEvent('basket:results', { detail: data }));
}

// ---------------------------------------------------------------------------
// Main results view
// ---------------------------------------------------------------------------

function draw() {
  announce();
  const stores = data.platformSummaries.filter(s => s.foundItemsCount > 0);
  const noResults = data.platformSummaries.filter(s => s.foundItemsCount === 0);

  if (stores.length === 0) {
    resultsEl.innerHTML = `
      <div class="alert alert-warn">
        <strong>No matching products for this basket.</strong>
        <p>Try simpler item names, like "milk", "atta 5kg" or "amul butter".</p>
      </div>`;
    return;
  }

  // Same order as the server: stores with every item, then more items found, then cheapest
  stores.sort((a, b) =>
    Number(b.isFullyAvailable) - Number(a.isFullyAvailable) || b.foundItemsCount - a.foundItemsCount || a.totalCost - b.totalCost);
  const best = stores[0].isFullyAvailable ? stores[0] : null;
  const shown = stores.find(s => s.platform.id === selectedId) || stores[0];

  const names = data.queryItems.map(q => q.rawQuery).join(' · ');
  resultsEl.innerHTML = `
    <div class="results-head">
      <div>
        <h2>Best price for your ${data.queryItems.length} item${data.queryItems.length > 1 ? 's' : ''}</h2>
        <p class="meta">${escapeHtml(names)} · every fee included</p>
      </div>
      <span class="pill-warn" title="Prices, ratings and fees are generated for this demo">Sample prices</span>
    </div>
    ${winnerHtml(shown, stores, shown === best)}
    ${compareHtml(stores, best, shown, noResults)}
    ${splitHtml(stores)}`;
}

// ---------------------------------------------------------------------------
// Winner card
// ---------------------------------------------------------------------------

const lineCost = product => product.price * (product.multiplier || 1);

/** Store fees for one order. Same rules as fees() in src/modules/basket/basket-optimizer.service.ts. */
function feesFor(platform, subtotal) {
  if (subtotal <= 0) return { delivery: 0, handling: 0, platform: 0, smallCart: 0, total: 0 };
  const delivery = subtotal < platform.freeDeliveryThreshold ? platform.baseDeliveryFee : 0;
  const smallCart = subtotal < platform.smallCartThreshold ? platform.smallCartFee : 0;
  return { delivery, handling: platform.handlingFee, platform: platform.platformFee, smallCart, total: delivery + platform.handlingFee + platform.platformFee + smallCart };
}

/** "delivery ₹30 · handling ₹4", or "no fees" */
function feesText(fees) {
  const parts = [['delivery', fees.delivery], ['handling', fees.handling], ['platform', fees.platform], ['small cart', fees.smallCart]]
    .filter(([, amount]) => amount > 0)
    .map(([label, amount]) => `${label} ${rupees(amount)}`);
  return parts.length ? parts.join(' · ') : 'no fees';
}

function winnerHtml(store, stores, isBest) {
  const p = store.platform;
  const complete = stores.filter(s => s.isFullyAvailable);
  const cheapest = complete[0];
  const priciest = complete.length > 1 ? complete[complete.length - 1] : null;

  let saving = '';
  if (isBest && priciest && priciest.totalCost > store.totalCost) {
    saving = `<p class="saving-pill"><svg class="icon icon-sm"><use href="#i-trending-down"/></svg>You save ${rupees(priciest.totalCost - store.totalCost)} vs ${escapeHtml(priciest.platform.name)}</p>`;
  } else if (!isBest && cheapest && store.isFullyAvailable) {
    saving = `<p class="saving-pill is-more">${rupees(store.totalCost - cheapest.totalCost)} more than ${escapeHtml(cheapest.platform.name)}</p>`;
  }

  return `
    <article class="winner${isBest ? ' is-best' : ''}">
      <div class="winner-summary">
        <span class="badge">${isBest ? 'Cheapest store' : 'Selected store'}</span>
        <div class="winner-store">
          ${storeAvatar(p)}
          <div>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="meta">${escapeHtml(p.estimatedDelivery)}</p>
          </div>
        </div>
        <p class="winner-price">${rupees(store.totalCost)}</p>
        <div>
          <p class="meta">Items ${rupees(store.subtotalPrice)} + fees ${rupees(store.fees.total)}</p>
          <p class="meta">${feesText(store.fees)}${p.freeDeliveryThreshold ? ` · free above ${rupees(p.freeDeliveryThreshold)}` : ''}</p>
        </div>
        ${saving}
        <p class="availability ${store.isFullyAvailable ? 'ok' : 'partial'}">${store.foundItemsCount} of ${store.totalRequestedItems} items available</p>
      </div>
      <div class="winner-items">
        <p class="overline">What you get at ${escapeHtml(p.name)}</p>
        <ul class="lines">${store.items.map((item, i) => lineHtml(store, item, i)).join('')}</ul>
        ${insightHtml()}
      </div>
    </article>`;
}

function insightHtml() {
  const prefix = '[AI Insights]: ';
  const line = data.agentLogs.find(log => log.startsWith(prefix));
  return line ? `<p class="insight"><svg class="icon"><use href="#i-sparkles"/></svg><span>${escapeHtml(line.slice(prefix.length))}</span></p>` : '';
}

function lineHtml(store, item, index) {
  const query = escapeHtml(data.queryItems[index]?.rawQuery);

  if (!item) {
    return `<li class="line"><div class="line-main"><span class="line-query">${query}</span><span class="line-missing">Not available at this store</span></div></li>`;
  }

  const packs = item.multiplier > 1 ? `<span class="tag" title="Packs needed to reach the size you asked for">${item.multiplier}×</span>` : '';
  const otherBrand = item.isSubstituted ? '<span class="tag tag-warn" title="Not the brand you asked for">Other brand</span>' : '';
  const alternatives = store.alternatives?.[index] || [];

  // More than one option: let the user pick, otherwise just show the name
  const product = alternatives.length > 1
    ? `<select class="select" data-store="${escapeHtml(store.platform.id)}" data-index="${index}" aria-label="Product for ${query}">
         ${alternatives.map(alt => `
           <option value="${escapeHtml(alt.id)}"${alt.id === item.id ? ' selected' : ''}>
             ${alt.multiplier > 1 ? `${alt.multiplier}× ` : ''}${escapeHtml(alt.rawTitle)} · ${rupees(lineCost(alt))}
           </option>`).join('')}
       </select>`
    : `<span class="line-product">${escapeHtml(item.rawTitle)}</span>`;

  const mrp = item.mrp > item.price ? `<s class="mrp">${rupees(item.mrp * (item.multiplier || 1))}</s>` : '';
  const rating = item.rating ? `<span class="meta">★ ${item.rating} · ${Number(item.reviewCount || 0).toLocaleString('en-IN')} reviews</span>` : '';

  return `
    <li class="line">
      <div class="line-main">
        <span class="line-query">${query} ${packs} ${otherBrand}</span>
        ${product}
        ${rating}
      </div>
      <div class="line-price">${rupees(lineCost(item))}${mrp}</div>
    </li>`;
}

// ---------------------------------------------------------------------------
// Comparison table
// ---------------------------------------------------------------------------

function compareHtml(stores, best, shown, noResults) {
  const rows = stores.map(s => {
    const isBest = s === best;
    const diff = isBest
      ? '<span class="badge">Cheapest</span>'
      : best && s.isFullyAvailable ? `<span class="cell-more">+${rupees(s.totalCost - best.totalCost)}</span>` : '<span class="cell-muted">–</span>';
    return `
      <button class="compare-row${isBest ? ' is-best' : ''}${s === shown ? ' is-selected' : ''}" type="button" data-pick="${escapeHtml(s.platform.id)}" aria-label="Show ${escapeHtml(s.platform.name)} basket">
        <span class="compare-store">${storeAvatar(s.platform)}<span><strong>${escapeHtml(s.platform.name)}</strong><span class="meta">${escapeHtml(s.platform.estimatedDelivery)}</span></span></span>
        <span class="col-num col-items cell-muted">${s.foundItemsCount} of ${s.totalRequestedItems}</span>
        <span class="col-num col-fees cell-muted">${rupees(s.fees.total)}</span>
        <span class="col-num cell-total">${rupees(s.totalCost)}</span>
        <span class="col-num">${diff}</span>
      </button>`;
  }).join('');

  const missing = noResults.length
    ? `<p class="compare-note">No matching products at ${noResults.map(s => escapeHtml(s.platform.name)).join(', ')}.</p>` : '';
  return `
    <div class="compare">
      <div class="compare-head" aria-hidden="true">
        <span>All stores</span><span class="col-num col-items">Items</span><span class="col-num col-fees">Fees</span><span class="col-num">Total</span><span class="col-num">vs best</span>
      </div>
      ${rows}
      ${missing}
    </div>`;
}

// Click a store in the table: show that store's basket in the card.
resultsEl.addEventListener('click', e => {
  const row = e.target.closest('[data-pick]');
  if (!row || !data) return;
  selectedId = row.dataset.pick;
  draw();
  resultsEl.querySelector('.winner')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// When the user picks another product in the card, recalculate that store's totals.
resultsEl.addEventListener('change', e => {
  const select = e.target.closest('select[data-store]');
  if (!select || !data) return;

  const store = data.platformSummaries.find(s => s.platform.id === select.dataset.store);
  const index = Number(select.dataset.index);
  const chosen = store?.alternatives?.[index]?.find(alt => alt.id === select.value);
  if (!chosen) return;

  store.items[index] = chosen;
  const found = store.items.filter(Boolean);
  store.subtotalPrice = found.reduce((sum, item) => sum + lineCost(item), 0);
  store.fees = feesFor(store.platform, store.subtotalPrice);
  store.totalCost = store.subtotalPrice + store.fees.total;
  store.foundItemsCount = found.length;
  store.isFullyAvailable = found.length === store.totalRequestedItems;

  selectedId = store.platform.id; // keep looking at the store the user just edited
  draw();
});

// ---------------------------------------------------------------------------
// Split plan
// ---------------------------------------------------------------------------

function splitHtml() {
  const split = data.splitCartRecommendation;
  if (!split.assignments.length) return '';

  // Group items by store
  const byStore = new Map();
  for (const a of split.assignments) {
    if (!byStore.has(a.chosenPlatform)) byStore.set(a.chosenPlatform, []);
    byStore.get(a.chosenPlatform).push(a);
  }

  if (byStore.size === 1) {
    const [storeName] = byStore.keys();
    return `
      <div class="split-tip">
        <span class="seg-icon"><svg class="icon icon-sm"><use href="#i-sparkles"/></svg></span>
        <span>Splitting your order across stores would not save money. One order from <strong>${escapeHtml(storeName)}</strong> is the cheapest.</span>
      </div>`;
  }

  const feesOf = name => split.fees.find(f => f.platform === name)?.fees || feesFor({}, 0);
  return `
    <h2 class="section-heading">Split into ${byStore.size} orders and save ${rupees(split.savingsVersusBestSinglePlatform)}</h2>
    <div class="split-plan">
      ${[...byStore].map(([storeName, assignments]) => `
        <div class="split-store">
          <div class="split-store-head">
            <span>${escapeHtml(storeName)}</span>
            <span>${rupees(assignments.reduce((sum, a) => sum + a.itemPrice, 0) + feesOf(storeName).total)}</span>
          </div>
          <ul>
            ${assignments.map(a => `
              <li><span>${escapeHtml(a.product.rawTitle)}</span><span>${rupees(a.itemPrice)}</span></li>`).join('')}
            <li class="meta"><span>Fees (${feesText(feesOf(storeName))})</span><span>${rupees(feesOf(storeName).total)}</span></li>
          </ul>
        </div>`).join('')}
    </div>`;
}
