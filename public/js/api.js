// Talks to our backend (src/server.ts).

// Server worst case: LLM parse (15s) + slowest store (45s) + AI summary (15s), plus some slack.
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Asks the server to compare the basket across stores.
 * @param {string[]} items  e.g. ["amul butter 500g", "milk"]
 * @param {{latitude: number, longitude: number, address: string}} location
 * @returns {Promise<object>}  UniversalBasketResponse (see src/types.ts)
 */
export async function optimizeBasket(items, location) {
  let res;
  try {
    res = await fetch('/api/basket/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, location }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`The stores took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to answer. Please try again.`);
    }
    throw new Error('Could not reach the server. Is it running?');
  }

  const data = await res.json().catch(() => ({}));
  // Nest sends { message: string | string[] } for errors (e.g. validation failures)
  if (!res.ok) throw new Error([].concat(data.message || `Server error (${res.status})`).join(' '));
  return data;
}
