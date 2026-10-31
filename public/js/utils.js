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
