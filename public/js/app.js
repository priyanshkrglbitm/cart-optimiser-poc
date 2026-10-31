// Entry point: connects the page parts together. Start reading here.

import { initTheme } from './theme.js';
import { initLocation } from './location.js';
import { initBasket } from './basket.js';
import { optimizeBasket } from './api.js';
import { renderEmpty, renderLoading, renderResults, renderError } from './results.js';

const statusEl = document.getElementById('status');
const compareButton = document.getElementById('compare-btn');
const showStatus = message => { statusEl.textContent = message; };

initTheme();
const getLocation = initLocation(showStatus);
const basket = initBasket();
renderEmpty();

compareButton.addEventListener('click', async () => {
  const items = basket.getItems();
  if (items.length === 0) return showStatus('Add at least one item first.');

  showStatus('');
  compareButton.disabled = true;
  compareButton.textContent = 'Comparing…';
  renderLoading(items.length);

  try {
    renderResults(await optimizeBasket(items, getLocation()));
  } catch (err) {
    renderError(err.message);
  } finally {
    compareButton.disabled = false;
    compareButton.textContent = 'Compare prices';
  }
});
