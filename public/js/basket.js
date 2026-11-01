// The basket: items are removable tokens inside the hero input, plus quick suggestions.

import { escapeHtml } from './utils.js';

const SUGGESTIONS = ['Eggs', 'Atta 5kg', 'Sunflower Oil', 'Doodh 1L', 'Bread', 'Paneer'];

/** @returns {{ getItems: () => string[] }} */
export function initBasket() {
  const items = ['Milk', 'Toor Dal', 'Butter'];

  const form = document.getElementById('add-form');
  const input = document.getElementById('item-input');
  const list = document.getElementById('basket-list');
  const presets = document.getElementById('presets');

  function add(text) {
    const item = text.trim();
    const alreadyAdded = items.some(existing => existing.toLowerCase() === item.toLowerCase());
    if (item && !alreadyAdded) items.push(item);
    render();
  }

  function render() {
    list.innerHTML = items.map((item, i) => `
      <li class="token">
        <span>${escapeHtml(item)}</span>
        <button class="token-x" type="button" data-index="${i}" aria-label="Remove ${escapeHtml(item)}">×</button>
      </li>`).join('');
    input.placeholder = items.length ? 'Add more, e.g. 12 eggs' : 'Add an item, e.g. 12 eggs';

    // Suggestions that are not in the basket yet
    const inBasket = new Set(items.map(i => i.toLowerCase()));
    presets.innerHTML = SUGGESTIONS.filter(s => !inBasket.has(s.toLowerCase()))
      .map(s => `<button class="chip" type="button" data-item="${escapeHtml(s)}">+ ${escapeHtml(s)}</button>`).join('');
  }

  form.addEventListener('submit', e => {
    e.preventDefault(); // stay on the page
    add(input.value);
    input.value = '';
    input.focus();
  });

  // Backspace in an empty input removes the last item, like a tag field
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && items.length) {
      items.pop();
      render();
    }
  });

  list.addEventListener('click', e => {
    const button = e.target.closest('.token-x');
    if (!button) return;
    items.splice(Number(button.dataset.index), 1);
    render();
    input.focus();
  });

  presets.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) add(chip.dataset.item);
  });

  render();
  return { getItems: () => [...items] };
}
