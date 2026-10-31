// The shopping list on the left: add, remove, quick presets.

import { escapeHtml } from './utils.js';

const PRESETS = ['Milk', 'Toor Dal', 'Butter', 'Sunflower Oil', 'Eggs', 'Atta 5kg'];

/** @returns {{ getItems: () => string[] }} */
export function initBasket() {
  const items = ['Milk', 'Toor Dal', 'Butter'];

  const form = document.getElementById('add-form');
  const input = document.getElementById('item-input');
  const list = document.getElementById('basket-list');
  const count = document.getElementById('item-count');
  const presets = document.getElementById('presets');

  function add(text) {
    const item = text.trim();
    const alreadyAdded = items.some(existing => existing.toLowerCase() === item.toLowerCase());
    if (item && !alreadyAdded) items.push(item);
    render();
  }

  function render() {
    count.textContent = items.length ? `${items.length} item${items.length > 1 ? 's' : ''}` : '';
    list.innerHTML = items.length
      ? items.map((item, i) => `
          <li class="basket-item">
            <span>${escapeHtml(item)}</span>
            <button class="remove-btn" type="button" data-index="${i}" aria-label="Remove ${escapeHtml(item)}">×</button>
          </li>`).join('')
      : '<li class="basket-empty">Your basket is empty. Add an item above.</li>';
  }

  form.addEventListener('submit', e => {
    e.preventDefault(); // stay on the page
    add(input.value);
    input.value = '';
    input.focus();
  });

  list.addEventListener('click', e => {
    const button = e.target.closest('.remove-btn');
    if (!button) return;
    items.splice(Number(button.dataset.index), 1);
    render();
  });

  presets.innerHTML = PRESETS.map(p => `<button class="chip" type="button" data-item="${escapeHtml(p)}">+ ${escapeHtml(p)}</button>`).join('');
  presets.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) add(chip.dataset.item);
  });

  render();
  return { getItems: () => [...items] };
}
