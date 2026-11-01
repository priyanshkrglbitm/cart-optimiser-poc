// Small helpers shared by the other files.

/** Makes text safe to put inside HTML. Product names come from store websites, so never insert them raw. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** 1234.5 → "₹1,234.5" */
export function rupees(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Brand-ish colours for store avatars, shared by the store list and the results
export const STORE_COLORS = {
  blinkit: '#f2c200',
  zepto: '#7b2cf5',
  instamart: '#fc8019',
  bigbasket: '#84c225',
  flipkart: '#2874f0',
  jiomart: '#0a6ebd',
};

/** "Swiggy Instamart" → "SI" */
export function initials(name) {
  return String(name).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Store avatar markup, coloured by the store's id. */
export function storeAvatar(platform) {
  return `<span class="store-avatar" style="background:${STORE_COLORS[platform.id] ?? '#64748b'}" aria-hidden="true">${escapeHtml(initials(platform.name))}</span>`;
}
