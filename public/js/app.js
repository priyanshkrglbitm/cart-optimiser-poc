// Entry point: connects the page parts together. Start reading here.

import { initTheme } from './theme.js';
import { initLocation } from './location.js';
import { initBasket } from './basket.js';
import { initAgent } from './agent.js';
import { initShell } from './shell.js';
import { initKpis } from './kpis.js';
import { optimizeBasket } from './api.js';
import { renderEmpty, renderLoading, renderResults, renderError } from './results.js';

const statusEl = document.getElementById('status');
const compareButton = document.getElementById('compare-btn');
const showStatus = message => { statusEl.textContent = message; };

initTheme();
const getLocation = initLocation(showStatus);
const basket = initBasket();
const agent = initAgent(getLocation, renderResults); // the agent's price comparison is drawn in the same results area
initShell(agent.send); // topbar search goes to the assistant
initKpis();
renderEmpty();

compareButton.addEventListener('click', async () => {
  const items = basket.getItems();
  if (items.length === 0) return showStatus('Add at least one item first.');
  const location = getLocation();
  if (!/^[1-9]\d{5}$/.test(location.pincode)) return showStatus('Enter a valid 6-digit pincode. Prices depend on it.');

  showStatus('');
  compareButton.disabled = true;
  compareButton.textContent = 'Comparing…';
  renderLoading(items.length);
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    renderResults(await optimizeBasket(items, location));
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    renderError(err.message);
  } finally {
    compareButton.disabled = false;
    compareButton.textContent = 'Compare prices';
  }
});
