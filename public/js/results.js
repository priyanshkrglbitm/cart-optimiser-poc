// Draws everything on the right: summary, AI insight, store cards, split plan.

import { escapeHtml, rupees } from './utils.js';

const resultsEl = document.getElementById('results');

// Last server response. Store totals change here when the user picks a different product.
let data = null;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function renderEmpty() {
  resultsEl.innerHTML = `
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">🧺</div>
      <h2>Find the cheapest way to buy your basket</h2>
      <p>Add items and set your location, then press <strong>Compare prices</strong>.
         You'll see each store's total and whether splitting the order saves money.</p>
    </div>`;
}

export function renderLoading(itemCount) {
  resultsEl.innerHTML = `
    <div class="loading">
      <div class="spinner" aria-hidden="true"></div>
      <span>Checking ${itemCount} item${itemCount > 1 ? 's' : ''} across stores. This can take up to a minute.</span>
    </div>
    <div class="store-grid">${'<div class="store-card skeleton"></div>'.repeat(3)}</div>`;
}

export function renderError(message) {
  resultsEl.innerHTML = `<div class="alert alert-error"><strong>Couldn't compare prices.</strong><p>${escapeHtml(message)}</p></div>`;
}

export function renderResults(response) {
  data = response;
  draw();
}

// ---------------------------------------------------------------------------
// Main results view
// ---------------------------------------------------------------------------

function draw() {
  const stores = data.platformSummaries.filter(s => s.foundItemsCount > 0);
  const noResults = data.platformSummaries.filter(s => s.foundItemsCount === 0);

  if (stores.length === 0) {
    resultsEl.innerHTML = `
      <div class="alert alert-warn">
        <strong>No store returned prices for this basket.</strong>
        <p>The stores may have blocked the request, or the items weren't found. Try again later or try simpler item names.</p>
      </div>`;
    return;
  }

  // Stores with every item first, then cheapest
  stores.sort((a, b) => Number(b.isFullyAvailable) - Number(a.isFullyAvailable) || a.totalCost - b.totalCost);
  const best = stores[0].isFullyAvailable ? stores[0] : null;

  resultsEl.innerHTML = `
    ${summaryHtml(best)}
    ${insightHtml()}
    <h2 class="section-heading">Stores</h2>
    <div class="store-grid">${stores.map(s => storeCardHtml(s, s === best)).join('')}</div>
    ${noResults.length ? `<p class="note">No prices from ${noResults.map(s => escapeHtml(s.platform.name)).join(', ')}. The store blocked the request or had no match.</p>` : ''}
    ${splitPlanHtml()}`;
}

function summaryHtml(best) {
  const itemCount = data.queryItems.length;
  const split = data.splitCartRecommendation;
  const orders = new Set(split.assignments.map(a => a.chosenPlatform)).size;

  const bestStat = best
    ? `<div class="stat-value">${rupees(best.totalCost)}</div>
       <div class="stat-sub">at ${escapeHtml(best.platform.name)}, all ${itemCount} items</div>`
    : `<div class="stat-value">–</div>
       <div class="stat-sub">No single store has all ${itemCount} items</div>`;

  const splitStat = split.assignments.length
    ? `<div class="stat-value">${rupees(split.optimizedTotalCost)}</div>
       <div class="stat-sub">${orders} order${orders > 1 ? 's' : ''}, delivery included${
         split.savingsVersusBestSinglePlatform > 0 ? ` · <strong>saves ${rupees(split.savingsVersusBestSinglePlatform)}</strong>` : ''
       }${split.assignments.length < itemCount ? ` · covers ${split.assignments.length} of ${itemCount} items` : ''}</div>`
    : `<div class="stat-value">–</div><div class="stat-sub">Nothing available to split</div>`;

  return `
    <div class="summary">
      <div class="stat"><div class="stat-label">Best single store</div>${bestStat}</div>
      <div class="stat stat-accent"><div class="stat-label">Cheapest split</div>${splitStat}</div>
    </div>`;
}

function insightHtml() {
  const prefix = '[AI Insights]: ';
  const line = data.agentLogs.find(log => log.startsWith(prefix));
  return line ? `<p class="insight">✨ ${escapeHtml(line.slice(prefix.length))}</p>` : '';
}

// ---------------------------------------------------------------------------
// Store cards
// ---------------------------------------------------------------------------

const lineCost = product => product.price * (product.multiplier || 1);

function storeCardHtml(store, isBest) {
  const p = store.platform;
  return `
    <article class="store-card${isBest ? ' is-best' : ''}">
      <div class="store-head">
        <div>
          <h3 class="store-name">${escapeHtml(p.name)}</h3>
          <p class="meta">${escapeHtml(p.estimatedDelivery)}</p>
        </div>
        ${isBest ? '<span class="badge">Cheapest</span>' : ''}
      </div>
      <p class="store-total">${rupees(store.totalCost)}</p>
      <p class="meta">Items ${rupees(store.subtotalPrice)} + delivery ${store.deliveryFee ? rupees(store.deliveryFee) : 'free'}${
        p.freeDeliveryThreshold ? ` · free above ${rupees(p.freeDeliveryThreshold)}` : ''}</p>
      <p class="availability ${store.isFullyAvailable ? 'ok' : 'partial'}">${store.foundItemsCount} of ${store.totalRequestedItems} items available</p>
      <ul class="lines">${store.items.map((item, i) => lineHtml(store, item, i)).join('')}</ul>
    </article>`;
}

function lineHtml(store, item, index) {
  const query = escapeHtml(data.queryItems[index]?.rawQuery);

  if (!item) {
    return `<li class="line"><div class="line-main"><span class="line-query">${query}</span><span class="line-missing">Not available</span></div></li>`;
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

  return `
    <li class="line">
      <div class="line-main">
        <span class="line-query">${query} ${packs} ${otherBrand}</span>
        ${product}
      </div>
      <div class="line-price">${rupees(lineCost(item))}${mrp}</div>
    </li>`;
}

// When the user picks another product in a store card, recalculate that store's totals.
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
  store.deliveryFee = store.subtotalPrice > 0 && store.subtotalPrice < store.platform.freeDeliveryThreshold ? store.platform.baseDeliveryFee : 0;
  store.totalCost = store.subtotalPrice + store.deliveryFee;
  store.foundItemsCount = found.length;
  store.isFullyAvailable = found.length === store.totalRequestedItems;

  draw();
});

// ---------------------------------------------------------------------------
// Split plan
// ---------------------------------------------------------------------------

function splitPlanHtml() {
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
    return `<h2 class="section-heading">Split plan</h2>
      <p class="note">Splitting doesn't save money here. Order everything from ${escapeHtml(storeName)}.</p>`;
  }

  const feeFor = name => split.deliveryFees?.find(f => f.platform === name)?.fee || 0;

  return `
    <h2 class="section-heading">Split plan</h2>
    <div class="split-plan">
      ${[...byStore].map(([storeName, assignments]) => `
        <div class="split-store">
          <div class="split-store-head">
            <span>${escapeHtml(storeName)}</span>
            <span>${rupees(assignments.reduce((sum, a) => sum + a.itemPrice, 0) + feeFor(storeName))}</span>
          </div>
          <ul>
            ${assignments.map(a => `
              <li><span>${escapeHtml(a.product.rawTitle)}</span><span>${rupees(a.itemPrice)}</span></li>`).join('')}
            <li class="meta"><span>Delivery</span><span>${feeFor(storeName) ? rupees(feeFor(storeName)) : 'free'}</span></li>
          </ul>
        </div>`).join('')}
    </div>`;
}
