// Talks to our Nest backend (src/modules/*/*.controller.ts).

// A request normally takes about a second; the agent can make several AI calls, so allow plenty of slack.
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Compares the basket across stores: POST /api/basket/optimize (BasketController).
 * @param {string[]} items  e.g. ["amul butter 500g", "milk"]
 * @param {{latitude: number, longitude: number, pincode: string, address: string}} location
 * @returns {Promise<object>}  UniversalBasketResponse (src/common/types/commerce.types.ts)
 */
export function optimizeBasket(items, location) {
  return postJson('/api/basket/optimize', { items, location });
}

/**
 * Sends the chat so far to the shopping agent: POST /api/agent/chat (AgentController).
 * @param {{role: 'user'|'assistant', content: string}[]} messages  oldest first
 * @returns {Promise<{reply: string, options?: string[], steps: object[], searches: object[], basket?: object}>}
 */
export function agentChat(messages, location) {
  return postJson('/api/agent/chat', { messages, location });
}

/** Every store with its delivery time and fees: GET /api/platforms (PlatformsController). */
export async function getPlatforms() {
  const res = await fetch('/api/platforms', { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json();
}

async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`No answer after ${REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.`);
    }
    throw new Error('Could not reach the server. Is it running?');
  }

  const data = await res.json().catch(() => ({}));
  // Nest sends { message: string | string[] } for errors (e.g. validation failures)
  if (!res.ok) throw new Error([].concat(data.message || `Server error (${res.status})`).join(' '));
  return data;
}
